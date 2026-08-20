/**
 * Deterministic, non-LLM recipe choice for total LLM outage — this
 * codebase's whole ethos is "plan generation always succeeds, worst case
 * with honest warnings" at the SELECTION layer; whether the resulting plan
 * clears the macro/plausibility/variety gates is a separate question the
 * caller (recipe-selector.ts) still checks identically for both paths, per
 * the confirmed "reject, no exemption for the fallback" decision.
 *
 * Per slot, picks one recipe per required meal-role bucket, rotated
 * deterministically by stableHash(dayIndex, slot, bucket) — same small
 * per-file pattern food-selector-fallback.ts/archetype-selector.ts/
 * mixed-veg-day.ts already use elsewhere in this codebase.
 */

import { recipeCategoryBucket, type RecipeCategoryBucket } from "./recipe-category"
import type { RecipeForPrompt, RecipeSelection, RecipeSelectorInput, SelectedRecipeDay, SelectedRecipeItem, SelectedRecipeMeal } from "./recipe-types"

const SLOT_BUCKET_PLAN: Record<string, RecipeCategoryBucket[]> = {
  breakfast: ["bread", "light_meal"],
  mid_morning: ["fruit", "beverage"],
  lunch: ["rice_pulao", "dal_curry", "sabzi"],
  evening: ["snack", "beverage"],
  dinner: ["bread", "dal_curry", "sabzi"],
  bedtime: ["beverage"],
}
const DEFAULT_SLOT_BUCKETS: RecipeCategoryBucket[] = ["light_meal"]

// Non-vegetarian: dinner always (not probabilistic) gets a real non-veg
// pick when one is eligible — mirroring CLAUDE.md's established exchange-
// engine precedent (meat_lean anchored permanently to dinner; "non-
// vegetarian" already has "eggetarian" as its own diet type for egg-only
// clients, so a fallback that only sometimes serves real meat defeats that
// distinction). Lunch stays vegetarian-style, same day-structure split.
const NON_VEG_SUBSTITUTE_SLOT = "dinner"

function isRealNonVegRecipe(dietTypes: string[]): boolean {
  return dietTypes.length === 1 && dietTypes[0] === "non_vegetarian"
}

function stableHash(...parts: string[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

export function recipeSelectorFallback(input: RecipeSelectorInput): RecipeSelection {
  const weekOffset = input.dayIndexOffset ?? 0

  const byBucket = new Map<RecipeCategoryBucket, RecipeForPrompt[]>()
  for (const r of input.eligibleRecipesForPrompt) {
    const bucket = recipeCategoryBucket(r.category)
    const list = byBucket.get(bucket) ?? []
    list.push(r)
    byBucket.set(bucket, list)
  }

  const nonVegPool = input.eligibleRecipesForPrompt.filter((r) => {
    const full = input.allRecipesById.get(r.id)
    return full ? isRealNonVegRecipe(full.dietTypes) : false
  })

  const days: SelectedRecipeDay[] = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const rotationDay = dayIndex + weekOffset
    const meals: SelectedRecipeMeal[] = input.slots.map((slotInfo) => {
      let buckets = SLOT_BUCKET_PLAN[slotInfo.slot] ?? DEFAULT_SLOT_BUCKETS
      const items: SelectedRecipeItem[] = []

      const useNonVeg = input.dietType === "non_vegetarian" && slotInfo.slot === NON_VEG_SUBSTITUTE_SLOT && nonVegPool.length > 0
      if (useNonVeg) {
        const pick = nonVegPool[stableHash(String(rotationDay), slotInfo.slot, "non_veg") % nonVegPool.length]
        items.push({ name: pick.name })
        buckets = buckets.filter((b) => b !== "dal_curry" && b !== "sabzi")
      }

      for (const bucket of buckets) {
        const pool = byBucket.get(bucket)
        if (!pool || pool.length === 0) continue
        const pick = pool[stableHash(String(rotationDay), slotInfo.slot, bucket) % pool.length]
        items.push({ name: pick.name })
      }

      if (items.length === 0 && input.eligibleRecipesForPrompt.length > 0) {
        const pool = input.eligibleRecipesForPrompt
        const pick = pool[stableHash(String(rotationDay), slotInfo.slot, "any") % pool.length]
        items.push({ name: pick.name })
      }

      return { slot: slotInfo.slot, items }
    })
    days.push({ dayIndex, meals })
  }

  return { days }
}
