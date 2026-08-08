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
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import {
  clients,
  counsellingSessions,
  dietPlanDays,
  dietPlanItems,
  dietPlanMeals,
  dietPlans,
  foods,
  mealTemplates,
  planGenerationRuns,
  roadmapOverrides,
  roadmaps,
} from "@/db/schema"
import type { Answers } from "@/lib/counselling/questions"
import { weekTargets, type RoadmapResult } from "@/lib/counselling/roadmap"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"
import { REGIONS } from "@/lib/foods/vocab"
import {
  ClientProfileError,
  clientAllergensFromAnswers,
  clientDislikesFromAnswers,
  dietTypeFromAnswers,
} from "@/lib/plan/client-profile-from-answers"
import { NoEligibleFoodsError, eligibleFoodsForSkeleton } from "@/lib/plan/eligible-foods"
import { solveExchanges } from "@/lib/plan/exchange-solver"
import { distributeMeals, type MealSlotTemplate } from "@/lib/plan/meal-distributor"
import { selectFoods, type AttemptLog } from "@/lib/plan/food-selector"
import type { PreviousWeekItem } from "@/lib/plan/food-selector-types"
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
 */
async function loadPreviousWeekSeed(
  roadmapId: string,
  weekNumber: number
): Promise<{ dayIndexOffset: number; previousWeekLastDay?: Record<string, PreviousWeekItem[]> }> {
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
  if (!lastDay) return { dayIndexOffset }

  const mealRows = await db.select().from(dietPlanMeals).where(eq(dietPlanMeals.dietPlanDayId, lastDay.id))
  if (mealRows.length === 0) return { dayIndexOffset }

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

  const previousWeekLastDay: Record<string, PreviousWeekItem[]> = {}
  for (const row of itemRows) {
    const list = previousWeekLastDay[row.slot] ?? []
    list.push({ exchangeType: row.item.exchangeType as ExchangeCode, foodId: row.item.foodId, nameEn: row.food.nameEn })
    previousWeekLastDay[row.slot] = list
  }

  return { dayIndexOffset, previousWeekLastDay }
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
  const { roadmapId, weekNumber, region, mealCount } = bodyResult.data

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

  const allFoods = await db.select().from(foods)

  let eligibleFoodsBySlot
  try {
    eligibleFoodsBySlot = eligibleFoodsForSkeleton(
      allFoods,
      { region, dietType, clientAllergens, clientDislikes },
      neededSlotsByExchangeType
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

  const { dayIndexOffset, previousWeekLastDay } = await loadPreviousWeekSeed(roadmapId, weekNumber)

  const attempts: AttemptLog[] = []
  const selectionResult = await selectFoods(
    { region, dietType, mealCount, skeleton, eligibleFoodsBySlot, dayIndexOffset, previousWeekLastDay },
    { onAttempt: (log) => attempts.push(log) }
  )

  // Persisted immediately — independent of whether the rest of generation
  // succeeds, so a failure downstream (deviation check, DB write) never
  // silently drops the audit trail a dietitian needs to self-diagnose
  // (/settings/generation-log). Linked to a plan once one exists below.
  let runIds: string[] = []
  if (attempts.length > 0) {
    const inserted = await db
      .insert(planGenerationRuns)
      .values(
        attempts.map((log) => ({
          clientId: client.id,
          roadmapId,
          weekNumber,
          dietPlanId: null,
          attemptNumber: log.attemptNumber,
          model: log.model,
          promptHash: log.promptHash,
          rawResponse: log.rawResponse,
          validationResult: log.validationResult,
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

  const anchorDate = session.submittedAt ?? session.createdAt
  const weekStartDate = addDays(anchorDate, (weekNumber - 1) * 7)
  const weekEndDate = addDays(weekStartDate, 6)

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

      for (const [slotOrder, meal] of day.meals.entries()) {
        const [mealRow] = await tx
          .insert(dietPlanMeals)
          .values({ dietPlanDayId: dayRow.id, slot: meal.slot, slotOrder })
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
      weekStart: toIsoDate(weekStartDate),
      weekEnd: toIsoDate(weekEndDate),
      achieved: priced.days[0].achieved,
      deviation: deviations[0],
    },
    { status: 201 }
  )
}
