/**
 * Formats a recipe item's grams as a whole-number natural quantity ("3
 * pieces", "1 cup") instead of a raw gram figure — a direct dietitian
 * correction: nobody plates "Roti — 105 g", they plate "2-3 rotis". Grams
 * are never shown alongside — confirmed choice, see the recipe engine's
 * quantity-display decision.
 *
 * Bare-count special case: whenever the derived unit word IS (a word in)
 * the recipe's own name — Fruit items ("Apple"), but also anything where
 * the source phrase's noun happened to repeat the dish name ("Rice" -> "1
 * cup cooked rice" -> noun "rice") — showing that noun would be redundant
 * right next to the name itself, so it's dropped in favour of a bare count
 * ("2", not "2 apples" or "1 rice"). Found live on a real generated plan,
 * not hypothesized in advance.
 */

export interface RecipeQuantityInput {
  name: string
  category: string
  unitLabel: string | null
  perUnitGrams: number | null
}

// Common Indian-recipe nouns whose plural isn't a plain "+s"/"+es" — kept
// small and only added to as real cases surface, not guessed exhaustively.
const IRREGULAR_PLURALS: Record<string, string> = {
  glass: "glasses",
  potato: "potatoes",
  tomato: "tomatoes",
  mango: "mangoes",
}

function pluralize(word: string, count: number): string {
  if (count === 1) return word
  if (word === "tbsp" || word === "tsp") return word
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word]
  // A noun scraped verbatim from source text ending in "s" ("peanuts",
  // "whites" from "2-3 egg whites") is very likely already plural as
  // typed — appending another "-es" produces "peanutses". Leave it as-is
  // rather than risk double-pluralizing; the known exceptions that
  // genuinely need "-es" (glass, ...) are covered by IRREGULAR_PLURALS
  // above, checked first.
  if (word.endsWith("s")) return word
  if (/[xz]$/i.test(word) || /[cs]h$/i.test(word)) return `${word}es`
  return `${word}s`
}

function nameContainsWord(recipeName: string, word: string): boolean {
  const target = word.toLowerCase()
  return recipeName
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w === target)
}

/** Returns null when the recipe has no derivable natural unit — callers should fall back to a gram figure in that case. */
export function formatRecipeQuantity(recipe: RecipeQuantityInput, grams: number): string | null {
  if (recipe.perUnitGrams === null || recipe.perUnitGrams <= 0) return null

  const count = Math.max(1, Math.round(grams / recipe.perUnitGrams))

  if (recipe.category === "Fruit" || (recipe.unitLabel && nameContainsWord(recipe.name, recipe.unitLabel))) {
    return String(count)
  }

  const label = recipe.unitLabel ?? "piece"
  return `${count} ${pluralize(label, count)}`
}
