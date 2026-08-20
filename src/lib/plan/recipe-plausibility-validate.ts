/**
 * A day can be perfectly on-macro (recipe-validate.ts) and still be a
 * nonsensical plate — this is a genuinely separate check, deliberately not
 * folded into the same function, so the day-retry diagnosis can tell the
 * model exactly which kind of problem it needs to fix.
 */

import { recipeCategoryBucket } from "./recipe-category"
import type { GroundedRecipeDay } from "./recipe-types"

export interface ClientRecipeConstraints {
  dietType: string
  eligibleCuisines: string[]
  allergenTags: string[]
}

// A meal may never stack more than one of these together — the same
// "implausible plate" shape the deleted dish engine's evening-snack-
// stacking fix addressed (a fried snack + a dessert + a creamy drink all in
// one slot, each individually a legitimate pick).
const RICH_BUCKETS_NOT_STACKED = new Set(["heavy_meal", "dessert"])

// mid_morning/evening/bedtime are snack/beverage-only occasions by this
// codebase's own established convention (the exchange engine's own
// meal_templates restrict these slots to fruit/fat/cereal — never a full
// MAIN dish) — a real live-generation run confirmed this fires on nearly
// every real day otherwise (mid_morning legitimately has only chai/fruit,
// never a MAIN item), so requiring one here was a bug, not a real
// plausibility problem.
const NO_MAIN_REQUIRED_SLOTS = new Set(["mid_morning", "evening", "bedtime"])

export function describePlausibilityProblems(day: GroundedRecipeDay, constraints: ClientRecipeConstraints): string[] {
  const problems: string[] = []

  for (const meal of day.meals) {
    if (meal.items.length === 0) {
      problems.push(`${meal.slot} has no resolved items`)
      continue
    }

    const namesSeen = new Set<string>()
    let richCount = 0
    let hasMain = false

    for (const item of meal.items) {
      if (namesSeen.has(item.recipe.name)) {
        problems.push(`${meal.slot} has a duplicate recipe: ${item.recipe.name}`)
      }
      namesSeen.add(item.recipe.name)

      if (item.recipe.mainOrMid === "main") hasMain = true
      if (RICH_BUCKETS_NOT_STACKED.has(recipeCategoryBucket(item.recipe.category))) richCount++

      // Defense-in-depth: the prompt pool was already pre-filtered by these
      // constraints, but a fuzzy-tier resolution could in principle land on
      // an ineligible recipe — this is the last checkpoint before pricing.
      if (!item.recipe.dietTypes.includes(constraints.dietType)) {
        problems.push(`${meal.slot}'s "${item.recipe.name}" is not eligible for diet type "${constraints.dietType}"`)
      }
      if (!constraints.eligibleCuisines.includes(item.recipe.cuisine)) {
        problems.push(`${meal.slot}'s "${item.recipe.name}" is not eligible for the requested cuisine`)
      }
      const forbiddenAllergen = item.recipe.allergenTags.find((t) => constraints.allergenTags.includes(t))
      if (forbiddenAllergen) {
        problems.push(`${meal.slot}'s "${item.recipe.name}" contains a declared allergen: ${forbiddenAllergen}`)
      }
    }

    if (!hasMain && !NO_MAIN_REQUIRED_SLOTS.has(meal.slot)) problems.push(`${meal.slot} has no MAIN item (all accompaniments)`)
    if (richCount > 1) problems.push(`${meal.slot} stacks ${richCount} rich (heavy meal/dessert) dishes together`)
  }

  return problems
}
