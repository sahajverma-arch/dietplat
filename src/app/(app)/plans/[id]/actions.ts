"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { counsellingSessions, dietPlanDays, dietPlanItems, dietPlanMeals, dietPlans, foods, roadmaps } from "@/db/schema"
import type { Answers } from "@/lib/counselling/questions"
import { requireStaffUser } from "@/lib/counselling/require-staff-user"
import { clientAllergensFromAnswers, clientDislikesFromAnswers } from "@/lib/plan/client-profile-from-answers"
import { filterEligibleFoods, type EligibilityCriteria } from "@/lib/plan/eligible-foods"
import { ACCEPTANCE_FRACTION } from "@/lib/plan/exchange-solver"

class SwapValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SwapValidationError"
  }
}

// Every ID here is normally sourced from server-rendered data (never
// user-typed), and Drizzle always parameterizes — so this isn't closing an
// injection hole, it's rejecting a malformed ID with a clear message
// instead of a confusing "not found" from a Server Action, which is
// reachable directly regardless of what the UI ever sends it.
const uuidSchema = z.string().uuid()

/**
 * Allergens/dislikes are re-derived live from the session's current
 * answers, not snapshotted on the plan — unlike region/dietType, an
 * allergy correction made after generation must immediately narrow what
 * the swap picker offers, never keep offering a food against stale data.
 */
async function loadItemContext(itemId: string) {
  const [row] = await db
    .select({ item: dietPlanItems, meal: dietPlanMeals, plan: dietPlans })
    .from(dietPlanItems)
    .innerJoin(dietPlanMeals, eq(dietPlanItems.dietPlanMealId, dietPlanMeals.id))
    .innerJoin(dietPlanDays, eq(dietPlanMeals.dietPlanDayId, dietPlanDays.id))
    .innerJoin(dietPlans, eq(dietPlanDays.dietPlanId, dietPlans.id))
    .where(eq(dietPlanItems.id, itemId))
    .limit(1)
  if (!row) return null

  const [roadmapRow] = await db.select().from(roadmaps).where(eq(roadmaps.id, row.plan.roadmapId)).limit(1)
  const sessionRows = roadmapRow
    ? await db.select().from(counsellingSessions).where(eq(counsellingSessions.id, roadmapRow.sessionId)).limit(1)
    : []
  const answers = (sessionRows[0]?.answers ?? {}) as Answers

  const criteria: EligibilityCriteria = {
    region: row.plan.region,
    dietType: row.plan.dietType,
    clientAllergens: clientAllergensFromAnswers(answers),
    clientDislikes: clientDislikesFromAnswers(answers),
  }

  return { ...row, criteria }
}

export interface SwapCandidate {
  id: string
  nameEn: string
  householdMeasure: string | null
}

export async function getSwapCandidates(itemId: string): Promise<SwapCandidate[]> {
  await requireStaffUser()
  itemId = uuidSchema.parse(itemId)

  const ctx = await loadItemContext(itemId)
  if (!ctx) return []

  const sameType = await db.select().from(foods).where(eq(foods.exchangeType, ctx.item.exchangeType))
  const eligible = filterEligibleFoods(sameType, ctx.criteria).filter((f) => f.mealSlots.includes(ctx.meal.slot))

  return eligible
    .filter((f) => f.id !== ctx.item.foodId)
    .map((f) => ({ id: f.id, nameEn: f.nameEn, householdMeasure: f.householdMeasure }))
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
}

export async function swapPlanItem(itemId: string, newFoodId: string): Promise<void> {
  await requireStaffUser()
  itemId = uuidSchema.parse(itemId)
  newFoodId = uuidSchema.parse(newFoodId)

  const ctx = await loadItemContext(itemId)
  if (!ctx) throw new SwapValidationError("Item not found.")
  if (ctx.plan.status === "approved") {
    throw new SwapValidationError("This plan is already approved — swaps are locked.")
  }

  const [newFood] = await db.select().from(foods).where(eq(foods.id, newFoodId)).limit(1)
  if (!newFood) throw new SwapValidationError("Food not found.")
  if (newFood.exchangeType !== ctx.item.exchangeType) {
    throw new SwapValidationError(`${newFood.nameEn} is exchange type ${newFood.exchangeType}, not ${ctx.item.exchangeType} — swap rejected.`)
  }

  const eligible = filterEligibleFoods([newFood], ctx.criteria)
  if (eligible.length === 0 || !newFood.mealSlots.includes(ctx.meal.slot)) {
    throw new SwapValidationError(`${newFood.nameEn} is not eligible for this client at ${ctx.meal.slot}.`)
  }

  // Exchange count never changes on a swap — same exchange type, same count,
  // only the food identity and its resulting gram weight change. Macros are
  // therefore unaffected: this is the exchange system's core guarantee (see
  // CLAUDE.md "THE ONE RULE THAT MATTERS").
  const servingRawG =
    newFood.servingRawG === null ? null : (ctx.item.exchangeCount / newFood.exchangeUnits) * newFood.servingRawG

  await db.update(dietPlanItems).set({ foodId: newFood.id, servingRawG }).where(eq(dietPlanItems.id, itemId))

  revalidatePath(`/plans/${ctx.plan.id}`)
}

export async function approvePlan(planId: string): Promise<void> {
  await requireStaffUser()
  planId = uuidSchema.parse(planId)

  const [plan] = await db.select().from(dietPlans).where(eq(dietPlans.id, planId)).limit(1)
  if (!plan) throw new Error("Plan not found.")

  const deviations = plan.deviation as Array<{ kcal: number; proteinG: number; fatG: number; carbsG: number }>
  const offending = deviations.some(
    (d) =>
      d.kcal >= ACCEPTANCE_FRACTION ||
      d.proteinG >= ACCEPTANCE_FRACTION ||
      d.fatG >= ACCEPTANCE_FRACTION ||
      d.carbsG >= ACCEPTANCE_FRACTION
  )
  if (offending) {
    throw new Error(
      `Plan deviation exceeds ${ACCEPTANCE_FRACTION * 100}% on at least one macro — cannot approve. Regenerate the plan instead.`
    )
  }

  await db.update(dietPlans).set({ status: "approved" }).where(eq(dietPlans.id, planId))
  revalidatePath(`/plans/${planId}`)
}
