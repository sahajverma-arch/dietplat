/**
 * Recipe repetition is tracked and enforced in code, not left as a hopeful
 * prompt instruction alone (the prompt's own "no recipe >2x across 7 days"
 * rule stays too, as a first line of defense — see recipe-prompt.ts).
 */

import type { GroundedRecipeDay } from "./recipe-types"

export const MAX_RECIPE_REPEATS_PER_WEEK = 2

export function trackRecipeUsage(days: GroundedRecipeDay[]): Map<string, number> {
  const usage = new Map<string, number>()
  for (const day of days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        usage.set(item.recipe.id, (usage.get(item.recipe.id) ?? 0) + 1)
      }
    }
  }
  return usage
}

export interface VarietyViolation {
  recipeId: string
  name: string
  count: number
}

export function findVarietyViolations(days: GroundedRecipeDay[]): VarietyViolation[] {
  const usage = trackRecipeUsage(days)
  const nameById = new Map<string, string>()
  for (const day of days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        nameById.set(item.recipe.id, item.recipe.name)
      }
    }
  }

  const violations: VarietyViolation[] = []
  for (const [recipeId, count] of usage) {
    if (count > MAX_RECIPE_REPEATS_PER_WEEK) {
      violations.push({ recipeId, name: nameById.get(recipeId) ?? recipeId, count })
    }
  }
  return violations
}

/**
 * Which specific days need a variety retry: computed once after the
 * whole-week initial grounding (a genuinely week-level signal, unlike the
 * per-day macro/plausibility checks) — a day is flagged the moment a
 * recipe's cumulative count (in day order) exceeds the cap on that day,
 * not for every day the recipe subsequently appears again.
 */
export function findDaysNeedingVarietyRetry(days: GroundedRecipeDay[]): Set<number> {
  const seenCount = new Map<string, number>()
  const daysToRetry = new Set<number>()
  const sortedDays = [...days].sort((a, b) => a.dayIndex - b.dayIndex)
  for (const day of sortedDays) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const count = (seenCount.get(item.recipe.id) ?? 0) + 1
        seenCount.set(item.recipe.id, count)
        if (count > MAX_RECIPE_REPEATS_PER_WEEK) daysToRetry.add(day.dayIndex)
      }
    }
  }
  return daysToRetry
}
