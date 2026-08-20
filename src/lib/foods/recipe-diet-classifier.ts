/**
 * Classifies a recipe's diet-type eligibility from the free-text `Diet Pref`
 * column (comma-separated tokens, e.g. "JAIN, VEGAN", "CHICKEN, NON
 * VEGETARIAN"). Token-based, not ingredient-based (unlike the deleted
 * dish-diet-classifier.ts) — this dataset authors diet preference directly
 * per recipe rather than deriving it from an ingredient list.
 *
 * Same POSITIVE-LIST convention the rest of this codebase uses (dietTypes
 * lists every client diet type this recipe is SAFE for, not "the narrowest
 * type") and the same widening hierarchy dish-diet-classifier.ts already
 * established: a dish containing real meat/fish/seafood is safe for
 * non_vegetarian clients only; an egg dish is safe for eggetarian AND
 * non_vegetarian; a plain vegetarian dish (no meat, no egg) is safe for
 * vegetarian, eggetarian, AND non_vegetarian clients (all of them can eat
 * vegetarian food); vegan/jain are ADDED on top only when the source
 * explicitly confirms them — never inferred from the absence of the token,
 * since silence about "VEGAN" doesn't confirm dairy is present, only that
 * it wasn't confirmed absent.
 *
 * Every one of the 25 distinct real Diet Pref values in the real CSV was
 * profiled directly before writing this (see recipe-csv-parser.ts's sibling
 * profiling pass) — the synonym table below covers every real typo found,
 * not a guessed superset.
 */

import type { DietType } from "@/lib/plan/exchange-solver"

const TOKEN_SYNONYMS: Record<string, string> = {
  OVOVETARAIN: "OVOVEGETARIAN",
  "OVO VEGETRAIAN": "OVOVEGETARIAN",
  OVOVETARIAN: "OVOVEGETARIAN",
  NONVEGETARIAN: "NON VEGETARIAN",
  NONVEGTARIAN: "NON VEGETARIAN",
}

const NON_VEG_TOKENS = new Set(["CHICKEN", "FISH", "SEAFOOD", "NON VEGETARIAN"])
const EGG_TOKENS = new Set(["EGG", "OVOVEGETARIAN"])
const KNOWN_TOKENS = new Set([...NON_VEG_TOKENS, ...EGG_TOKENS, "VEGETARIAN", "VEGAN", "JAIN"])

function normalizeToken(raw: string): string {
  const cleaned = raw.trim().toUpperCase()
  return TOKEN_SYNONYMS[cleaned] ?? cleaned
}

export interface RecipeDietClassification {
  dietTypes: DietType[]
  /** True when any raw token mapped to an EGG_TOKENS entry — used to add a hard-excludable "egg" allergen tag independent of dietTypes, see recipe-allergen-normalize.ts. */
  containsEgg: boolean
  /** True when the raw tokens explicitly named FISH — used the same way as containsEgg, reinforcing the Allergen column's own fish/seafood tagging. */
  containsFish: boolean
  containsSeafood: boolean
  unclassifiedTokens: string[]
}

export function classifyRecipeDietTypes(rawDietPref: string): RecipeDietClassification {
  const tokens = rawDietPref
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map(normalizeToken)

  const unclassifiedTokens = tokens.filter((t) => !KNOWN_TOKENS.has(t))

  const hasNonVeg = tokens.some((t) => NON_VEG_TOKENS.has(t))
  const hasEgg = tokens.some((t) => EGG_TOKENS.has(t))
  const hasVegetarian = tokens.includes("VEGETARIAN")
  const hasVegan = tokens.includes("VEGAN")
  const hasJain = tokens.includes("JAIN")
  const containsFish = tokens.includes("FISH")
  const containsSeafood = tokens.includes("SEAFOOD")

  let dietTypes: DietType[]
  if (hasNonVeg) {
    dietTypes = ["non_vegetarian"]
  } else if (hasEgg) {
    dietTypes = ["eggetarian", "non_vegetarian"]
  } else if (hasVegetarian || hasVegan || hasJain) {
    dietTypes = ["vegetarian", "eggetarian", "non_vegetarian"]
    if (hasVegan) dietTypes.push("vegan")
    if (hasJain) dietTypes.push("jain")
  } else {
    // No real row in the profiled dataset falls here — every one of the 25
    // distinct raw values resolves above. Kept as an explicit, non-silent
    // empty result (never "assume safe for everyone") in case a future CSV
    // update introduces a genuinely novel Diet Pref value.
    dietTypes = []
  }

  return { dietTypes, containsEgg: hasEgg, containsFish, containsSeafood, unclassifiedTokens }
}
