/**
 * POST /api/plan/generate — turns a roadmap snapshot + week number into a
 * priced, food-filled diet plan. Node runtime (not edge): the NVIDIA call
 * plus up to 3 retries with backoff can run long. See CLAUDE.md "THE ONE
 * RULE THAT MATTERS" — every number here comes from roadmap.ts /
 * exchange-solver.ts / quantity.ts; the LLM (inside selectFoods) only ever
 * returns food IDs.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { and, eq, gte, inArray, isNull, or } from "drizzle-orm"

import { db } from "@/db"
import {
  archetypeComponents,
  clients,
  counsellingSessions,
  dietPlanDays,
  dietPlanItems,
  dietPlanMeals,
  dietPlans,
  foods,
  mealArchetypes,
  mealTemplates,
  planGenerationRuns,
  roadmapOverrides,
  roadmaps,
  vegetableDishCombinationMembers,
  vegetableDishCombinations,
} from "@/db/schema"
import type { Answers } from "@/lib/counselling/questions"
import { weekTargets, type RoadmapResult } from "@/lib/counselling/roadmap"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"
import { env } from "@/lib/env"
import { REGIONS, SEASONS } from "@/lib/foods/vocab"
import {
  ClientProfileError,
  clientAllergensFromAnswers,
  clientDislikesFromAnswers,
  dietTypeFromAnswers,
} from "@/lib/plan/client-profile-from-answers"
import { selectArchetypesForWeek, type ArchetypeAssignment, type ArchetypeCandidate } from "@/lib/plan/archetype-selector"
import { NoEligibleFoodsError, eligibleFoodsForSkeleton, type DishFamilyConstraintsBySlot } from "@/lib/plan/eligible-foods"
import { solveExchanges } from "@/lib/plan/exchange-solver"
import { distributeMeals, type MealSlotTemplate } from "@/lib/plan/meal-distributor"
import { selectFoods, type AttemptLog } from "@/lib/plan/food-selector"
import { checkArchetypeAdherence } from "@/lib/plan/food-selector-validate"
import type { FoodSelectorInput, PreviousWeekItem } from "@/lib/plan/food-selector-types"
import { seasonFor } from "@/lib/plan/season"
import type { ExchangeCode } from "@/lib/plan/table-4-1"
import {
  ExchangeTypeMismatchError,
  PricedSelectionDeviationError,
  UnknownFoodError,
  assertWithinTolerance,
  priceSelection,
} from "@/lib/plan/quantity"
import { RateLimitExceededError, checkAndRecordPlanGenerationRequest } from "@/lib/plan/rate-limit"
import { isSameOrigin } from "@/lib/require-same-origin"

export const runtime = "nodejs"
export const maxDuration = 120

const requestSchema = z.object({
  roadmapId: z.string().uuid(),
  weekNumber: z.number().int().min(1),
  region: z.enum(REGIONS),
  mealCount: z.number().int().positive().default(5),
  // Derived from week_start + region (season.ts) when omitted — a
  // dietitian override, not something the UI needs to ask for by default.
  season: z.enum(SEASONS).optional(),
})

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * "Generate next week" (Prompt 8): continues the fallback selector's
 * rotation across weeks and gives the LLM prompt the prior week's last day,
 * so week N doesn't reuse week N-1's exact food set on day 0. Falls back to
 * a bare day-index offset (still avoids resetting the rotation to 0) if no
 * previous-week plan exists yet — e.g. week 3 generated before week 2.
 *
 * Also carries archetype continuity (Meal Archetype layer, additive): the
 * archetype ids used on the previous week's final two days, by slot,
 * mirroring the food-continuity role above — archetype-selector.ts's
 * RECENT_DAYS_AVOIDED is 2, so that's how far back this looks.
 */
async function loadPreviousWeekSeed(
  roadmapId: string,
  weekNumber: number
): Promise<{
  dayIndexOffset: number
  previousWeekLastDay?: Record<string, PreviousWeekItem[]>
  recentArchetypeIdsBySlot?: Record<string, string[]>
}> {
  if (weekNumber <= 1) return { dayIndexOffset: 0 }
  const dayIndexOffset = (weekNumber - 1) * 7

  const [previousPlan] = await db
    .select()
    .from(dietPlans)
    .where(and(eq(dietPlans.roadmapId, roadmapId), eq(dietPlans.weekNumber, weekNumber - 1)))
    .limit(1)
  if (!previousPlan) return { dayIndexOffset }

  const [lastDay] = await db
    .select()
    .from(dietPlanDays)
    .where(and(eq(dietPlanDays.dietPlanId, previousPlan.id), eq(dietPlanDays.dayIndex, 6)))
    .limit(1)

  let previousWeekLastDay: Record<string, PreviousWeekItem[]> | undefined
  if (lastDay) {
    const mealRows = await db.select().from(dietPlanMeals).where(eq(dietPlanMeals.dietPlanDayId, lastDay.id))
    if (mealRows.length > 0) {
      const itemRows = await db
        .select({ item: dietPlanItems, food: foods, slot: dietPlanMeals.slot })
        .from(dietPlanItems)
        .innerJoin(dietPlanMeals, eq(dietPlanItems.dietPlanMealId, dietPlanMeals.id))
        .innerJoin(foods, eq(dietPlanItems.foodId, foods.id))
        .where(
          inArray(
            dietPlanItems.dietPlanMealId,
            mealRows.map((m) => m.id)
          )
        )

      previousWeekLastDay = {}
      for (const row of itemRows) {
        const list = previousWeekLastDay[row.slot] ?? []
        list.push({ exchangeType: row.item.exchangeType as ExchangeCode, foodId: row.item.foodId, nameEn: row.food.nameEn })
        previousWeekLastDay[row.slot] = list
      }
    }
  }

  const recentDays = await db
    .select()
    .from(dietPlanDays)
    .where(and(eq(dietPlanDays.dietPlanId, previousPlan.id), gte(dietPlanDays.dayIndex, 5)))

  let recentArchetypeIdsBySlot: Record<string, string[]> | undefined
  if (recentDays.length > 0) {
    const recentMeals = await db
      .select()
      .from(dietPlanMeals)
      .where(
        inArray(
          dietPlanMeals.dietPlanDayId,
          recentDays.map((d) => d.id)
        )
      )
    recentArchetypeIdsBySlot = {}
    for (const meal of recentMeals) {
      if (!meal.archetypeId) continue
      const list = recentArchetypeIdsBySlot[meal.slot] ?? []
      list.push(meal.archetypeId)
      recentArchetypeIdsBySlot[meal.slot] = list
    }
  }

  return { dayIndexOffset, previousWeekLastDay, recentArchetypeIdsBySlot }
}

export async function POST(request: Request) {
  // Route Handlers don't get Next's Server Action CSRF protection —
  // cookie auth alone can't stop a cross-site request from riding an
  // authenticated session. This is the app's only mutating Route Handler
  // (everything else is a Server Action).
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 })
  }

  const user = await requireStaffUser()

  try {
    await checkAndRecordPlanGenerationRequest(user.id)
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: err.message, retryAfterSeconds: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      )
    }
    throw err
  }

  const bodyResult = requestSchema.safeParse(await request.json().catch(() => null))
  if (!bodyResult.success) {
    return NextResponse.json({ error: "Invalid request body", details: bodyResult.error.flatten() }, { status: 400 })
  }
  const { roadmapId, weekNumber, region, mealCount, season: seasonOverride } = bodyResult.data

  const [roadmapRow] = await db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId)).limit(1)
  if (!roadmapRow) {
    return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  }

  const [sessionRow] = await db
    .select({ session: counsellingSessions, client: clients })
    .from(counsellingSessions)
    .innerJoin(clients, eq(counsellingSessions.clientId, clients.id))
    .where(eq(counsellingSessions.id, roadmapRow.sessionId))
    .limit(1)
  if (!sessionRow) {
    return NextResponse.json({ error: "Counselling session for this roadmap not found" }, { status: 404 })
  }
  const { session, client } = sessionRow

  // Moved ahead of eligible-foods (was previously computed just before the
  // DB transaction, much further down) so the seasonal filter can derive
  // from the real week_start instead of "now" — the week a plan covers can
  // start in a different season than the day it's generated on.
  const anchorDate = session.submittedAt ?? session.createdAt
  const weekStartDate = addDays(anchorDate, (weekNumber - 1) * 7)
  const weekEndDate = addDays(weekStartDate, 6)
  const season = seasonOverride ?? seasonFor(toIsoDate(weekStartDate), region)

  const roadmapOutput = roadmapRow.output as RoadmapResult
  const overrides = await db.select().from(roadmapOverrides).where(eq(roadmapOverrides.roadmapId, roadmapId))
  const overriddenCodes = new Set(overrides.map((o) => o.flagCode))
  const blockFlags = roadmapOutput.flags.filter((f) => f.level === "block" || f.level === "stop")
  const unresolvedBlocks = blockFlags.filter((f) => !overriddenCodes.has(f.code))
  if (unresolvedBlocks.length > 0) {
    return NextResponse.json(
      {
        error: "Roadmap has unresolved block-level flags — record a dietitian override on the review page first.",
        flags: unresolvedBlocks,
      },
      { status: 422 }
    )
  }

  const templateRows = await db
    .select({
      slot: mealTemplates.slot,
      slotOrder: mealTemplates.slotOrder,
      kcalShare: mealTemplates.kcalShare,
      allowedExchangeTypes: mealTemplates.allowedExchangeTypes,
    })
    .from(mealTemplates)
    .where(and(eq(mealTemplates.region, region), eq(mealTemplates.mealCount, mealCount)))
  if (templateRows.length === 0) {
    return NextResponse.json(
      { error: `No meal templates seeded for region "${region}" with mealCount ${mealCount}.` },
      { status: 422 }
    )
  }
  const templates: MealSlotTemplate[] = templateRows.map((r) => ({
    ...r,
    allowedExchangeTypes: r.allowedExchangeTypes as ExchangeCode[],
  }))

  const dailyTarget = weekTargets(roadmapOutput, weekNumber)

  let dietType
  try {
    dietType = dietTypeFromAnswers(session.answers as Answers)
  } catch (err) {
    if (err instanceof ClientProfileError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
  const clientAllergens = clientAllergensFromAnswers(session.answers as Answers)
  const clientDislikes = clientDislikesFromAnswers(session.answers as Answers)

  const solverResult = solveExchanges({
    kcal: dailyTarget.kcal,
    proteinG: dailyTarget.proteinG,
    fatG: dailyTarget.fatG,
    carbsG: dailyTarget.carbsG,
    fibreG: dailyTarget.fibreG,
    dietType,
    sugarEnabled: false,
  })
  if (!solverResult.ok) {
    return NextResponse.json(
      { error: solverResult.reason, best: solverResult.best },
      { status: 422 }
    )
  }

  const skeleton = distributeMeals(solverResult.exchangeCounts, templates)

  const neededSlotsByExchangeType = new Map<ExchangeCode, Set<string>>()
  for (const [slot, items] of Object.entries(skeleton)) {
    for (const item of items) {
      const slots = neededSlotsByExchangeType.get(item.exchangeType) ?? new Set<string>()
      slots.add(slot)
      neededSlotsByExchangeType.set(item.exchangeType, slots)
    }
  }

  // Moved ahead of eligible-foods so the archetype layer below can use
  // dayIndexOffset/recentArchetypeIdsBySlot — otherwise unchanged from
  // before this layer existed, still a single self-contained read.
  const { dayIndexOffset, previousWeekLastDay, recentArchetypeIdsBySlot } = await loadPreviousWeekSeed(
    roadmapId,
    weekNumber
  )

  // --- Meal Archetype layer (additive) -----------------------------------
  // Sits between meal distribution and eligible-foods filtering, exactly
  // as approved: never touches solverResult/skeleton (nutrition is already
  // fully decided above this line), only narrows which foods are eligible
  // to fill a slot the solver+distributor already solved. Querying
  // archetype tables is skipped entirely when the kill switch is off — "no
  // archetype behavior should execute" is true at the DB-access level, not
  // just the output level.
  const archetypeCandidatesBySlot: Record<string, ArchetypeCandidate[]> = {}
  if (env.ARCHETYPE_SELECTION_ENABLED) {
    const archetypeRows = await db
      .select({
        id: mealArchetypes.id,
        code: mealArchetypes.code,
        name: mealArchetypes.name,
        slot: mealArchetypes.slot,
        dietTypes: mealArchetypes.dietTypes,
        authenticityScore: mealArchetypes.authenticityScore,
        componentRole: archetypeComponents.componentRole,
        dishFamilyIds: archetypeComponents.dishFamilyIds,
        componentExchangeType: archetypeComponents.exchangeType,
        isRequired: archetypeComponents.isRequired,
      })
      .from(mealArchetypes)
      .innerJoin(archetypeComponents, eq(archetypeComponents.archetypeId, mealArchetypes.id))
      .where(and(eq(mealArchetypes.region, region), eq(mealArchetypes.isActive, true)))

    const archetypesById = new Map<string, ArchetypeCandidate>()
    for (const row of archetypeRows) {
      if (!row.dietTypes.includes(dietType)) continue
      let candidate = archetypesById.get(row.id)
      if (!candidate) {
        candidate = { id: row.id, code: row.code, name: row.name, authenticityScore: row.authenticityScore, components: [] }
        archetypesById.set(row.id, candidate)
        ;(archetypeCandidatesBySlot[row.slot] ??= []).push(candidate)
      }
      candidate.components.push({
        role: row.componentRole,
        dishFamilyIds: row.dishFamilyIds,
        exchangeType: row.componentExchangeType as ExchangeCode,
        isRequired: row.isRequired,
      })
    }
  }

  const archetypeAssignmentsByDay: ArchetypeAssignment[][] = selectArchetypesForWeek({
    slots: templates.map((t) => t.slot),
    candidatesBySlot: archetypeCandidatesBySlot,
    dayIndexOffset,
    recentArchetypeIdsBySlot,
    enabled: env.ARCHETYPE_SELECTION_ENABLED,
  })

  // Weekly union, per (slot, exchangeType), of every day's chosen
  // archetype's acceptable dish families — narrows eligibility once for
  // the whole week (matching how eligibleFoodsBySlot has always been
  // day-invariant), then the existing, UNCHANGED rotation logic (LLM
  // anti-repetition rules, fallback's stableHash rotation) picks day to
  // day within that narrower, coherence-biased pool. Empty when no
  // archetype applied anywhere, which produces byte-identical eligibility
  // output to before this layer existed (see eligible-foods.ts).
  const dishFamilyConstraints: DishFamilyConstraintsBySlot = {}
  for (const dayAssignments of archetypeAssignmentsByDay) {
    for (const assignment of dayAssignments) {
      if (!assignment.archetypeId) continue
      const bucket = (dishFamilyConstraints[assignment.slot] ??= {})
      for (const component of assignment.components) {
        const existing = bucket[component.exchangeType] ?? []
        bucket[component.exchangeType] = [...new Set([...existing, ...component.dishFamilyIds])]
      }
    }
  }
  // -------------------------------------------------------------------------

  const allFoods = await db.select().from(foods)

  // Fed into food-selector-fallback.ts so it can let vegetable_a/vegetable_b
  // co-occur in one slot when it's a real named dish (Aloo Gobi etc.) —
  // previously this data only ever got loaded at DISPLAY time
  // (plan-view-model.ts), too late for the selector to use it. Same
  // sorted-pair convention as pairKey() in food-selector-fallback.ts.
  const curatedVegetableCombinationRows = await db
    .select()
    .from(vegetableDishCombinations)
    .where(and(eq(vegetableDishCombinations.isActive, true), or(isNull(vegetableDishCombinations.region), eq(vegetableDishCombinations.region, region))))
  const curatedVegetableFamilyPairs = new Set<string>()
  if (curatedVegetableCombinationRows.length > 0) {
    const memberRows = await db
      .select()
      .from(vegetableDishCombinationMembers)
      .where(
        inArray(
          vegetableDishCombinationMembers.vegetableDishCombinationId,
          curatedVegetableCombinationRows.map((c) => c.id)
        )
      )
    const familiesByCombo = new Map<string, string[]>()
    for (const m of memberRows) {
      const list = familiesByCombo.get(m.vegetableDishCombinationId) ?? []
      list.push(m.dishFamilyId)
      familiesByCombo.set(m.vegetableDishCombinationId, list)
    }
    for (const combo of curatedVegetableCombinationRows) {
      const families = familiesByCombo.get(combo.id) ?? []
      // Only a genuine vegetable_a + vegetable_b PAIR is relevant here —
      // composeMealDisplay() always resolves each type to exactly one food
      // per slot, so a cross-type co-occurrence is always exactly 2 items.
      if (families.length === 2) curatedVegetableFamilyPairs.add([...families].sort().join("|"))
    }
  }

  let eligibleFoodsBySlot
  try {
    eligibleFoodsBySlot = eligibleFoodsForSkeleton(
      allFoods,
      { region, dietType, clientAllergens, clientDislikes, season },
      neededSlotsByExchangeType,
      dishFamilyConstraints
    )
  } catch (err) {
    if (err instanceof NoEligibleFoodsError) {
      return NextResponse.json(
        { error: err.message, exchangeType: err.exchangeType, slot: err.slot, failedFilter: err.failedFilter },
        { status: 422 }
      )
    }
    throw err
  }

  const foodSelectorInput: FoodSelectorInput = {
    region,
    dietType,
    mealCount,
    skeleton,
    eligibleFoodsBySlot,
    dayIndexOffset,
    previousWeekLastDay,
    archetypeAssignmentsByDay,
    curatedVegetableFamilyPairs,
  }

  const attempts: AttemptLog[] = []
  const selectionResult = await selectFoods(foodSelectorInput, { onAttempt: (log) => attempts.push(log) })

  // Informational only (Meal Archetype layer) — never affects generation
  // success/failure. Computed against whichever selection actually won
  // (LLM or fallback), attached below to the LAST logged attempt purely
  // for observability; nutrition validation (assertWithinTolerance,
  // further down) is entirely separate and unaffected by this.
  const archetypeAdherence = checkArchetypeAdherence(selectionResult.selection, archetypeAssignmentsByDay, foodSelectorInput)

  // Persisted immediately — independent of whether the rest of generation
  // succeeds, so a failure downstream (deviation check, DB write) never
  // silently drops the audit trail a dietitian needs to self-diagnose
  // (/settings/generation-log). Linked to a plan once one exists below.
  let runIds: string[] = []
  if (attempts.length > 0) {
    const inserted = await db
      .insert(planGenerationRuns)
      .values(
        attempts.map((log, i) => ({
          clientId: client.id,
          roadmapId,
          weekNumber,
          dietPlanId: null,
          attemptNumber: log.attemptNumber,
          model: log.model,
          promptHash: log.promptHash,
          rawResponse: log.rawResponse,
          validationResult:
            i === attempts.length - 1 && archetypeAdherence.length > 0
              ? { ...log.validationResult, archetypeAdherence }
              : log.validationResult,
          latencyMs: log.latencyMs,
        }))
      )
      .returning({ id: planGenerationRuns.id })
    runIds = inserted.map((r) => r.id)
  }

  const foodsById = new Map(allFoods.map((f) => [f.id, f]))
  let priced
  try {
    priced = priceSelection(selectionResult.selection, foodsById)
  } catch (err) {
    if (err instanceof UnknownFoodError || err instanceof ExchangeTypeMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    throw err
  }

  let deviations
  try {
    deviations = assertWithinTolerance(priced, dailyTarget)
  } catch (err) {
    if (err instanceof PricedSelectionDeviationError) {
      return NextResponse.json({ error: err.message, deviations: err.deviations }, { status: 500 })
    }
    throw err
  }

  const dietPlanId = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(dietPlans)
      .values({
        clientId: client.id,
        roadmapId,
        weekNumber,
        weekStart: toIsoDate(weekStartDate),
        weekEnd: toIsoDate(weekEndDate),
        region,
        dietType,
        targets: dailyTarget,
        // Identical every day by construction — every food within an
        // exchange type carries the same Table 4.1 macros, so the achieved
        // total only depends on the (fixed, per-day) exchange counts.
        achieved: priced.days[0].achieved,
        deviation: deviations,
        generationMode: selectionResult.generationMode,
        modelUsed: selectionResult.modelUsed,
        preparedBy: user.id,
        status: "draft",
      })
      .returning({ id: dietPlans.id })

    for (const day of priced.days) {
      const [dayRow] = await tx
        .insert(dietPlanDays)
        .values({
          dietPlanId: plan.id,
          dayIndex: day.dayIndex,
          date: toIsoDate(addDays(weekStartDate, day.dayIndex)),
          achieved: day.achieved,
        })
        .returning({ id: dietPlanDays.id })

      for (const meal of day.meals) {
        // Real display order, looked up by slot name from the meal
        // templates rather than trusted from the meal's position in
        // day.meals — that array's order matches slot_order only
        // incidentally (it falls out of Object.entries(skeleton) at
        // generation time), so this is the authoritative source regardless.
        const slotOrder = templates.find((t) => t.slot === meal.slot)?.slotOrder ?? 0
        // Observability only (Meal Archetype layer) — never read by
        // nutrition math. null whenever no archetype applied, which is
        // exactly what every diet_plan_meals row looked like before this
        // layer existed.
        const archetypeId =
          archetypeAssignmentsByDay[day.dayIndex]?.find((a) => a.slot === meal.slot)?.archetypeId ?? null
        const [mealRow] = await tx
          .insert(dietPlanMeals)
          .values({ dietPlanDayId: dayRow.id, slot: meal.slot, slotOrder, archetypeId })
          .returning({ id: dietPlanMeals.id })

        if (meal.items.length > 0) {
          await tx.insert(dietPlanItems).values(
            meal.items.map((item) => ({
              dietPlanMealId: mealRow.id,
              foodId: item.foodId,
              exchangeType: item.exchangeType,
              exchangeCount: item.exchangeCount,
              servingRawG: item.servingRawG,
            }))
          )
        }
      }
    }

    if (runIds.length > 0) {
      await tx.update(planGenerationRuns).set({ dietPlanId: plan.id }).where(inArray(planGenerationRuns.id, runIds))
    }

    return plan.id
  })

  return NextResponse.json(
    {
      dietPlanId,
      generationMode: selectionResult.generationMode,
      modelUsed: selectionResult.modelUsed,
      attempts: selectionResult.attempts,
      season,
      weekStart: toIsoDate(weekStartDate),
      weekEnd: toIsoDate(weekEndDate),
      achieved: priced.days[0].achieved,
      deviation: deviations[0],
    },
    { status: 201 }
  )
}
