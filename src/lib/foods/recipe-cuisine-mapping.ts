/**
 * Normalizes the recipe CSV's real `Cuisine` column (15 distinct raw
 * values, profiled directly: General 762, North Indian 184, South Indian
 * 76, Maharashtrian 60, Bengali 52, Italian 23, Gujarati 17, Chinese 17,
 * Mediterranean 13, Mexican 7, Exotic 7, Gujrati [typo] 2, Parsi 2,
 * Japanese 1, Goan 1).
 *
 * Per the confirmed decision: every cuisine outside the 5 known Indian
 * regional ones — Italian, Chinese, Mediterranean, Mexican, Exotic, Parsi,
 * Japanese, Goan, and any other unrecognized raw string — is relabeled to
 * "General" AT INGESTION, permanently folding it into the always-eligible
 * pool. This is a deliberate, one-way data-loss transformation: a recipe's
 * original non-Indian cuisine tag is only recoverable from `raw_csv_row`
 * afterward, never from `recipes.cuisine` itself.
 */

import type { REGIONS } from "./vocab"

export const RECIPE_CUISINES = ["General", "North Indian", "South Indian", "Maharashtrian", "Bengali", "Gujarati"] as const
export type RecipeCuisine = (typeof RECIPE_CUISINES)[number]

const RAW_CUISINE_SYNONYMS: Record<string, RecipeCuisine> = { Gujrati: "Gujarati" }

const KNOWN_REGIONAL_CUISINES = new Set<RecipeCuisine>(["North Indian", "South Indian", "Maharashtrian", "Bengali", "Gujarati"])

export function normalizeCuisine(raw: string): RecipeCuisine {
  const cleaned = (RAW_CUISINE_SYNONYMS[raw.trim()] ?? raw.trim()) as RecipeCuisine
  return KNOWN_REGIONAL_CUISINES.has(cleaned) ? cleaned : "General"
}

export function eligibleCuisinesFor(requested: RecipeCuisine): RecipeCuisine[] {
  return [...new Set([requested, "General" as RecipeCuisine])]
}

/**
 * Which existing meal_templates.region row supplies slot skeleton (slot
 * name/order/timeHint ONLY — never kcalShare/allowedExchangeTypes, which
 * stay exchange-engine-only) for a given recipe cuisine. Slot timing isn't
 * cuisine-dependent (breakfast is ~8am regardless of cuisine) — this reuses
 * existing seeded infrastructure for pure scheduling, not a macro decision.
 */
export const CUISINE_TO_TEMPLATE_REGION: Partial<Record<RecipeCuisine, (typeof REGIONS)[number]>> = {
  "North Indian": "north_indian",
  "South Indian": "south_indian",
  Maharashtrian: "maharashtrian",
  Bengali: "bengali",
  Gujarati: "gujarati",
}

export const DEFAULT_TEMPLATE_REGION: (typeof REGIONS)[number] = "north_indian"

export function templateRegionForCuisine(cuisine: RecipeCuisine): (typeof REGIONS)[number] {
  return CUISINE_TO_TEMPLATE_REGION[cuisine] ?? DEFAULT_TEMPLATE_REGION
}
