/**
 * Two eligibility filters applied to the recipe pool BEFORE the model ever
 * sees it. Both were found by inspecting a real rejected plan, not reasoned
 * from first principles.
 *
 * Deliberately applied at eligibility time (pure functions over the queried
 * rows) rather than as an `is_active` flag written at ingestion. Both are
 * code, so they take effect without a reseed and a later
 * `npm run seed:recipes` cannot silently undo them — the exact failure mode
 * CLAUDE.md records for the Milk/`milk_cow` mealSlots regression.
 *
 * Nothing here invents or edits a nutrition figure; each filter only decides
 * whether a row may be offered to the model at all.
 */

import type { DailyRecipeTarget } from "../plan/recipe-types"

/** The macro fields these filters read — kept structural so both DB rows and test fixtures satisfy it. */
export interface PoolFilterRecipe {
  name: string
  category: string
  kcalPer100G: number
  fatPer100G: number
}

/**
 * Categories where a genuinely zero-calorie row is correct: plain water,
 * infusions and teas. Everything else claiming 0 kcal is bad data.
 */
const ZERO_KCAL_PLAUSIBLE_CATEGORIES = new Set(["Morning Water", "Bedtime Water", "Tea"])

/**
 * A row that claims to be food but declares no energy at all.
 *
 * Real examples found in the ingested CSV: "Any Veg" and "Any Veg (W/O Aloo,
 * Arbi, Paneer, Soy)" — placeholders rather than dishes, which were being
 * plated to a dietitian as "Any Veg (150 g)"; and "Watermelon", "Moong Dal
 * Idli", "Kandi Pachadi" at 0 kcal, which is simply wrong. The second group
 * is the more damaging: the balancer will happily assign 250 g of an idli
 * that contributes nothing, so the day's arithmetic stays "correct" while
 * the client is told to eat something the plan does not count.
 *
 * NOT a blanket "0 kcal is invalid" rule — Lukewarm Water, Apple Cider
 * Vinegar and the green teas are all legitimately 0 and stay eligible.
 */
export function isNutritionallyEmpty(recipe: PoolFilterRecipe): boolean {
  return recipe.kcalPer100G <= 0 && !ZERO_KCAL_PLAUSIBLE_CATEGORIES.has(recipe.category)
}

/** Share of a recipe's calories coming from fat. 0 for a zero-calorie row, which keeps drinks out of the fat filter's way. */
export function fatShareOfKcal(recipe: PoolFilterRecipe): number {
  if (recipe.kcalPer100G <= 0) return 0
  return (recipe.fatPer100G * 9) / recipe.kcalPer100G
}

/** Share of the client's target calories that should come from fat. */
export function targetFatShare(target: DailyRecipeTarget): number {
  if (target.kcal <= 0) return 0
  return (target.fatG * 9) / target.kcal
}

/**
 * How far above the client's own fat share a recipe may sit and still be
 * offered. 1.5 keeps a normal spread of everyday dishes — a target of 25%
 * still admits anything up to 37.5% — while excluding the calorie-dense
 * outliers (nuts, chocolate, cream-heavy curries) that the model kept
 * reaching for.
 */
export const FAT_SHARE_HEADROOM = 1.5

/**
 * Below this many recipes the fat filter is abandoned entirely rather than
 * handing the model a starved pool — the same "degrade to the unfiltered
 * case" pattern used throughout the exchange engine's own selectors.
 */
export const MIN_POOL_AFTER_FAT_FILTER = 150

/**
 * WHY A FAT-SHARE FILTER AT ALL. Measured on a real rejected week: fat ran
 * over target on all 7 days (+17% to +115%) while carbs ran under on 5 of 7,
 * and nearly every dish was pinned at a serving limit. The pool itself is
 * not the problem — its median fat share is 25%, exactly the client's
 * target. SELECTION was: the chosen dishes averaged 47% of calories from
 * fat. The balancer can only scale grams, so once a day's dish set sits at
 * 47% fat no gram assignment reaches 25%, and every item pins at its bound
 * trying.
 *
 * This narrows what the model may choose from; it never fabricates a macro
 * and never overrides the balancer. Degrades to the unfiltered pool when it
 * would leave too little to compose from — including the case of a
 * genuinely high-fat prescription, where little would be excluded anyway.
 */
export function filterByFatShare<T extends PoolFilterRecipe>(recipes: T[], target: DailyRecipeTarget): T[] {
  const share = targetFatShare(target)
  if (share <= 0) return recipes

  const ceiling = share * FAT_SHARE_HEADROOM
  const kept = recipes.filter((r) => fatShareOfKcal(r) <= ceiling)
  return kept.length >= MIN_POOL_AFTER_FAT_FILTER ? kept : recipes
}

/** Both filters, in the order they should be applied. Empty rows are always dropped; the fat filter may decline to narrow. */
export function filterRecipePool<T extends PoolFilterRecipe>(recipes: T[], target: DailyRecipeTarget): T[] {
  return filterByFatShare(
    recipes.filter((r) => !isNutritionallyEmpty(r)),
    target
  )
}
