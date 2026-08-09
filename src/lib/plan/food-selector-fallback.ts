/**
 * Deterministic round-robin selector used after 3 failed LLM attempts. No
 * randomness (Math.random would make plan_generation_runs unreproducible) —
 * rotation comes from a stable hash of (slot, exchangeType) so different
 * slots don't all start at the same food, plus the day index.
 *
 * Real plans (Deepak/Anjali) use ONE food per (slot, exchangeType) even at
 * high exchange counts (5 cereal exchanges = one "Roti" line), except
 * vegetable_a / vegetable_b / fruit, which the real plans split into 2
 * distinct items when the slot needs 2+ exchanges (e.g. dinner's two
 * vegetable_a items). SPLITTABLE_TYPES mirrors that.
 *
 * Same-day protein exclusion: without this, whether e.g. lunch and dinner
 * land on the same pulse is pure chance — stableHash(slot, "pulse") happens
 * to be congruent mod several common pool sizes, so most regions saw the
 * identical pulse at both meals on every single day (see the meal-variety
 * design conversation this accompanies). PROTEIN_EXCHANGE_TYPES tracks, per
 * day, which dish family (or bare food, when untagged) each protein-bearing
 * slot already used, and excludes it from later same-day slots' pool —
 * falling back to the unfiltered pool whenever exclusion would empty it, so
 * this can never throw or leave a slot unfilled. Purely a same-day ordering
 * preference over an already-eligible pool: never changes exchange counts,
 * pool membership, or quantities.
 */

import type { ExchangeCode } from "./table-4-1"
import type { Food } from "@/db/schema"
import type { FoodSelectorInput, Selection, SelectedDay, SelectedItem, SelectedMeal } from "./food-selector-types"

const SPLITTABLE_TYPES = new Set<ExchangeCode>(["vegetable_a", "vegetable_b", "fruit"])
const PROTEIN_EXCHANGE_TYPES = new Set<ExchangeCode>(["pulse", "meat", "meat_lean"])

/** Dish family when tagged, else the food's own id — the same granularity used to exclude "no repeat" across a day. */
function familyKey(food: Food): string {
  return food.dishFamilyId ?? food.id
}

function stableHash(...parts: string[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

export function fallbackSelection(input: FoodSelectorInput): Selection {
  const days: SelectedDay[] = []
  const weekOffset = input.dayIndexOffset ?? 0

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const rotationDay = dayIndex + weekOffset
    const meals: SelectedMeal[] = []
    // Reset per day — see PROTEIN_EXCHANGE_TYPES above. Populated as slots
    // are resolved below, in skeleton order (breakfast..dinner), so a later
    // slot the same day always sees what an earlier one already used.
    const usedFamilyKeysToday = new Map<ExchangeCode, Set<string>>()

    for (const [slot, items] of Object.entries(input.skeleton)) {
      const selectedItems: SelectedItem[] = []

      for (const item of items) {
        const eligible = input.eligibleFoodsBySlot[slot]?.[item.exchangeType] ?? []
        if (eligible.length === 0) {
          throw new Error(
            `Fallback selector: no eligible foods for ${item.exchangeType} at ${slot} — this should have been caught by eligible-foods.ts.`
          )
        }

        const offset = stableHash(slot, item.exchangeType)
        const shouldSplit = SPLITTABLE_TYPES.has(item.exchangeType) && item.count >= 2 && eligible.length >= 2

        if (shouldSplit) {
          const idxA = (rotationDay + offset) % eligible.length
          const idxB = (idxA + 1) % eligible.length
          const totalHalfUnits = Math.round(item.count * 2)
          const halfUnitsA = Math.ceil(totalHalfUnits / 2)
          const halfUnitsB = totalHalfUnits - halfUnitsA

          selectedItems.push({ foodId: eligible[idxA].id, exchangeType: item.exchangeType, exchangeCount: halfUnitsA / 2 })
          selectedItems.push({ foodId: eligible[idxB].id, exchangeType: item.exchangeType, exchangeCount: halfUnitsB / 2 })
        } else if (PROTEIN_EXCHANGE_TYPES.has(item.exchangeType)) {
          const usedFamilyKeys = usedFamilyKeysToday.get(item.exchangeType) ?? new Set<string>()
          const unused = eligible.filter((f) => !usedFamilyKeys.has(familyKey(f)))
          // "unless no alternatives exist" — degrade to the full pool rather
          // than force a NoEligibleFoodsError-shaped outcome for what is
          // only ever a same-day repetition preference, never a hard rule.
          const pool = unused.length > 0 ? unused : eligible

          const idx = (rotationDay + offset) % pool.length
          const chosen = pool[idx]
          selectedItems.push({ foodId: chosen.id, exchangeType: item.exchangeType, exchangeCount: item.count })

          usedFamilyKeys.add(familyKey(chosen))
          usedFamilyKeysToday.set(item.exchangeType, usedFamilyKeys)
        } else {
          const idx = (rotationDay + offset) % eligible.length
          selectedItems.push({ foodId: eligible[idx].id, exchangeType: item.exchangeType, exchangeCount: item.count })
        }
      }

      meals.push({ slot, items: selectedItems })
    }

    days.push({ dayIndex, meals })
  }

  return { days }
}
