/**
 * Maps raw counselling Answers to the food-selection inputs the exchange
 * solver and eligible-foods filter need: diet type, hard allergen
 * exclusions, and dislikes. Deliberately separate from roadmap-input.ts —
 * that file feeds the deterministic engine, this one feeds food selection,
 * and the two must never merge (see CLAUDE.md "THE ONE RULE THAT MATTERS":
 * this file never touches a calorie or macro number).
 */

import type { Answers } from "@/lib/counselling/questions"
import type { DietType } from "./exchange-solver"

export class ClientProfileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClientProfileError"
  }
}

// q33 options -> solver DietType. Pescatarian/Flexitarian have no dedicated
// solver mode; non_vegetarian is the closest fit (broadest eligible set —
// never narrower than what the client actually eats). "Other" defaults to
// vegetarian, the safest assumption when the pattern is unspecified.
const DIET_TYPE_BY_ANSWER: Record<string, DietType> = {
  Vegetarian: "vegetarian",
  Eggetarian: "eggetarian",
  Vegan: "vegan",
  "Non-vegetarian": "non_vegetarian",
  Jain: "jain",
  Pescatarian: "non_vegetarian",
  Flexitarian: "non_vegetarian",
  Other: "vegetarian",
}

// q27 option label -> the slug ALLERGEN_TYPE_QUESTIONS built its q27_{slug}_type id from.
const ALLERGEN_LABEL_TO_SLUG: Record<string, string> = {
  Milk: "milk",
  Egg: "egg",
  Peanut: "peanut",
  "Tree nuts": "tree_nuts",
  Wheat: "wheat",
  Soy: "soy",
  Fish: "fish",
  Shellfish: "shellfish",
  Sesame: "sesame",
  Curd: "curd",
  Paneer: "paneer",
  Dal: "dal",
  Chickpeas: "chickpeas",
  "Rajma or beans": "rajma_or_beans",
  Onion: "onion",
  Garlic: "garlic",
  "Spicy food": "spicy_food",
  "Fried food": "fried_food",
  "High-fat food": "high_fat_food",
  "Artificial sweeteners": "artificial_sweeteners",
  "Protein powder": "protein_powder",
  Other: "other",
}

// slug -> foods.allergens vocab (src/lib/foods/vocab.ts ALLERGENS). Only
// slugs with a real food-safety mapping appear here — "Onion", "Spicy food"
// etc aren't allergen tags on any food row, so they can't be hard-excluded
// this way; they're intolerances/preferences, not what q27 calls "Allergy —
// never serve".
const ALLERGEN_SLUG_TO_VOCAB: Record<string, string> = {
  milk: "dairy",
  curd: "dairy",
  paneer: "dairy",
  egg: "egg",
  peanut: "peanut",
  tree_nuts: "tree_nut",
  wheat: "gluten",
  soy: "soy",
  fish: "fish",
  shellfish: "shellfish",
}

export function dietTypeFromAnswers(answers: Answers): DietType {
  const value = answers.q33
  const mapped = typeof value === "string" ? DIET_TYPE_BY_ANSWER[value] : undefined
  if (!mapped) {
    throw new ClientProfileError(
      `q33 (food pattern) is required to generate a plan and must be one of ${Object.keys(DIET_TYPE_BY_ANSWER).join(", ")}.`
    )
  }
  return mapped
}

/** Only "Allergy — never serve" classifications hard-exclude; "Intolerance" is a softer signal handled elsewhere, not a food filter. */
export function clientAllergensFromAnswers(answers: Answers): string[] {
  const reported = answers.q27
  const labels = Array.isArray(reported) ? reported.filter((l): l is string => typeof l === "string") : []
  const vocab = new Set<string>()

  for (const label of labels) {
    const slug = ALLERGEN_LABEL_TO_SLUG[label]
    if (!slug) continue
    if (answers[`q27_${slug}_type`] !== "Allergy — never serve") continue
    const mappedVocab = ALLERGEN_SLUG_TO_VOCAB[slug]
    if (mappedVocab) vocab.add(mappedVocab)
  }

  return [...vocab]
}

/** q36 is free text ("which foods do you dislike"), matched against food names by eligible-foods.ts — best-effort, not a structured vocab. */
export function clientDislikesFromAnswers(answers: Answers): string[] {
  const raw = answers.q36
  if (typeof raw !== "string" || raw.trim() === "") return []
  return raw
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
