/**
 * Normalizes the raw CSV `Consistency` column (Liquid/Solid, occasionally
 * blank/unrecognized) onto a fixed two-value vocabulary. Used by
 * recipe-plausibility-validate.ts to stop a liquid dish (soup/tea/shake)
 * from anchoring lunch or dinner — a soft signal on top of, not instead of,
 * recipeCategoryBucket()'s own soup/beverage detection from the Category
 * column, since Category text doesn't reliably catch every liquid dish.
 * Unrecognized/blank values map to null (not thrown on, unlike
 * normalizeHeavyLight in seed-recipes.ts) — this is a plausibility hint,
 * not a value the platform's arithmetic depends on.
 */

export type RecipeConsistency = "liquid" | "solid"

export function normalizeRecipeConsistency(raw: string): RecipeConsistency | null {
  const cleaned = raw.trim().toLowerCase()
  if (cleaned === "liquid") return "liquid"
  if (cleaned === "solid") return "solid"
  return null
}
