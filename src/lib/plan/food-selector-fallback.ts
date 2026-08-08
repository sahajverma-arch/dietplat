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
 */

import type { ExchangeCode } from "./table-4-1"
import type { FoodSelectorInput, Selection, SelectedDay, SelectedItem, SelectedMeal } from "./food-selector-types"

const SPLITTABLE_TYPES = new Set<ExchangeCode>(["vegetable_a", "vegetable_b", "fruit"])

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
