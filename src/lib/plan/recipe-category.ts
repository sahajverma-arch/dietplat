/**
 * Substring-match bucketing of a recipe's raw `Category` column (~69 real
 * distinct values, not fully enumerable in advance) into a small fixed set
 * — used only by the deterministic fallback selector's meal-role pooling
 * and the serving-limit fallback table (recipe-quantity-normalize.ts), NOT
 * for filtering what the LLM sees (the LLM gets the full eligible pool,
 * unfiltered by bucket — see recipe-prompt.ts).
 *
 * Every category landing on "other" must be printed by seed-recipes.ts so
 * this table gets extended against real ingestion output, not guessed.
 */

export type RecipeCategoryBucket =
  | "heavy_meal"
  | "light_meal"
  | "sabzi"
  | "dal_curry"
  | "rice_pulao"
  | "bread"
  | "snack"
  | "dessert"
  | "salad"
  | "soup"
  | "beverage"
  | "fruit"
  | "other"

export function recipeCategoryBucket(category: string): RecipeCategoryBucket {
  const c = category.toLowerCase()
  if (c.includes("heavy meal")) return "heavy_meal"
  if (c.includes("light meal")) return "light_meal"
  if (c.includes("sabzi")) return "sabzi"
  if (c.includes("curry") || c.includes("dal") || c.includes("khichdi") || c.includes("khichuri")) return "dal_curry"
  if (c.includes("rice") || c.includes("pulao") || c.includes("biryani")) return "rice_pulao"
  if (c.includes("roti") || c.includes("paratha") || c.includes("chila") || c.includes("wrap") || c.includes("sandwich")) return "bread"
  if (c.includes("snack") || c.includes("chaat")) return "snack"
  if (c.includes("dessert")) return "dessert"
  if (c.includes("salad") || c.includes("raita")) return "salad"
  if (c.includes("soup")) return "soup"
  if (c.includes("smoothie") || c.includes("juice") || c.includes("water") || c.includes("cereal")) return "beverage"
  if (c.includes("fruit")) return "fruit"
  return "other"
}
