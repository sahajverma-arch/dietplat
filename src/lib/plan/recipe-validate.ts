/**
 * Nutrition (macro) validation only — composition/plausibility checks live
 * in recipe-plausibility-validate.ts, deliberately separate (a day can be
 * perfectly on-macro and still be a nonsensical plate, and the two failure
 * modes need independent diagnosis).
 *
 * RECIPE_MACRO_TOLERANCE starts deliberately looser than spec point 7's
 * literal ±5% — real cooked recipes with real authored serving ranges make
 * 5% a materially harder bar than either the exchange or dish engine ever
 * had to clear. Start at the conservative end of the user-approved 8-10%
 * relaxation range; watch real convergence data from live generations and
 * tighten toward 5% only once proven, never loosen further without an
 * equally explicit decision.
 */

import type { DailyRecipeTarget, RecipeAchievedMacros } from "./recipe-types"

export const RECIPE_MACRO_TOLERANCE = 0.08

function pctOff(achieved: number, target: number): number {
  if (target === 0) return achieved === 0 ? 0 : 1
  return Math.abs(achieved - target) / target
}

/** kcal, proteinG, carbsG, fatG ONLY — fiber is deliberately excluded (confirmed: soft target, never gates a write). */
export function isRecipeDayOffTarget(totals: RecipeAchievedMacros, target: DailyRecipeTarget): boolean {
  return (
    pctOff(totals.kcal, target.kcal) > RECIPE_MACRO_TOLERANCE ||
    pctOff(totals.proteinG, target.proteinG) > RECIPE_MACRO_TOLERANCE ||
    pctOff(totals.carbsG, target.carbsG) > RECIPE_MACRO_TOLERANCE ||
    pctOff(totals.fatG, target.fatG) > RECIPE_MACRO_TOLERANCE
  )
}

/** Computed and returned for logging/display, never feeds isRecipeDayOffTarget's boolean — see "Fiber: soft target, still logged". */
export function fiberDeviationPct(totals: RecipeAchievedMacros, target: DailyRecipeTarget): number {
  return pctOff(totals.fiberG, target.fiberG)
}

// Below this, a plain percentage number alone ("carbs is 62% under target")
// wasn't steering the model toward a fix — live testing showed it kept
// picking another light snack/beverage rather than a substantial dish, even
// across 3 retries. Past this threshold, name the actual fix instead of
// just the number.
const LARGE_MISS_THRESHOLD = 0.25

export function describeMacroProblems(totals: RecipeAchievedMacros, target: DailyRecipeTarget): string[] {
  const problems: string[] = []
  const check = (label: string, achieved: number, targetVal: number, actionableHint?: (pct: number) => string | null) => {
    const pct = pctOff(achieved, targetVal)
    if (pct > RECIPE_MACRO_TOLERANCE) {
      const direction = achieved > targetVal ? "over" : "under"
      problems.push(`${label} is ${(pct * 100).toFixed(0)}% ${direction} target (${achieved.toFixed(0)} vs ${targetVal.toFixed(0)})`)
      const hint = actionableHint?.(pct)
      if (hint) problems.push(hint)
    }
  }
  check("kcal", totals.kcal, target.kcal, (pct) =>
    totals.kcal < target.kcal && pct > LARGE_MISS_THRESHOLD
      ? "This day is well under its calorie target — swap a light snack/beverage item at lunch or dinner for a substantial Rice/Roti/Dal Curry/Heavy Meal dish, don't just add more of a small item."
      : null
  )
  check("protein", totals.proteinG, target.proteinG)
  check("carbs", totals.carbsG, target.carbsG, (pct) =>
    totals.carbsG < target.carbsG && pct > LARGE_MISS_THRESHOLD
      ? "Carbs are well under target — at least one of lunch or dinner needs a real cereal/rice dish (Roti, Paratha, Rice, Pulao) as its base, not just dal/sabzi/salad/soup alone."
      : null
  )
  check("fat", totals.fatG, target.fatG)
  return problems
}

/** Weekly-average version of the same per-day gate — the actual write-blocking check, mirroring the exchange/dish engines' own weekly-average gates. */
export function isRecipeWeekOffTarget(weeklyAverage: RecipeAchievedMacros, target: DailyRecipeTarget): boolean {
  return isRecipeDayOffTarget(weeklyAverage, target)
}
