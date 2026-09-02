/**
 * Matches the CSV's dietitian-authored pairing data (recipes.
 * mustHaveCategories/goodToHaveCategories/mustHaveRecipeNames/
 * goodToHaveRecipeNames — see db/schema.ts and recipe-pairing-normalize.ts)
 * against a meal's actual items. Case-insensitive throughout: the raw
 * columns carry real casing/whitespace drift (e.g. "seeds" vs "Seeds",
 * "Rice+ Curry" vs "Curry + Rice") that was never worth hand-normalizing at
 * ingestion when a cheap compare handles it just as well at match time.
 *
 * Shared between recipe-plausibility-validate.ts (the hard "must have" gate
 * — an unsatisfied requirement rejects the day and triggers a retry) and
 * recipe-selector-fallback.ts (a best-effort repair pass, since the
 * deterministic fallback has no LLM to retry with — see its own comment).
 * "Good to have" is never enforced here; it's rendered in the prompt only
 * (recipe-prompt.ts) as a soft steer for the model.
 */

import type { RecipeForPrompt } from "./recipe-types"

function includesCaseInsensitive(list: string[], value: string): boolean {
  const target = value.toLowerCase()
  return list.some((v) => v.toLowerCase() === target)
}

/** True if `item` declares no "must have" requirement, or the requirement is met by at least one of `siblingCategories`/`siblingNames` (the rest of the same meal). */
export function isMustHaveSatisfied(item: Pick<RecipeForPrompt, "mustHaveCategories" | "mustHaveRecipeNames">, siblingCategories: string[], siblingNames: string[]): boolean {
  if (item.mustHaveCategories.length === 0 && item.mustHaveRecipeNames.length === 0) return true
  return (
    item.mustHaveCategories.some((c) => includesCaseInsensitive(siblingCategories, c)) ||
    item.mustHaveRecipeNames.some((n) => includesCaseInsensitive(siblingNames, n))
  )
}

/**
 * Finds a real candidate from `pool` satisfying one of `categories`/`names`
 * — deterministic pick via the caller-supplied index (same rotation
 * discipline as recipe-selector-fallback.ts's own stableHash usage), not a
 * random choice. Returns null if the pool has no eligible companion at all
 * (a genuinely unsatisfiable requirement for this client's eligible pool —
 * left for the caller to decide what to do, never silently invented).
 */
export function findPairingCompanion(pool: RecipeForPrompt[], categories: string[], names: string[], rotationIndex: number, exclude: Set<string>): RecipeForPrompt | null {
  const lowerCategories = categories.map((c) => c.toLowerCase())
  const lowerNames = names.map((n) => n.toLowerCase())
  const candidates = pool.filter(
    (r) => !exclude.has(r.name.toLowerCase()) && (lowerCategories.includes(r.category.toLowerCase()) || lowerNames.includes(r.name.toLowerCase()))
  )
  if (candidates.length === 0) return null
  return candidates[rotationIndex % candidates.length]
}
