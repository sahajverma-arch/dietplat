import { describe, expect, it } from "vitest"

import { fallbackSelection } from "./food-selector-fallback"
import { makeFood } from "./test-fixtures"
import type { FoodSelectorInput } from "./food-selector-types"

const roti = makeFood({ id: "roti", nameEn: "Roti", exchangeType: "cereal" })
const rice = makeFood({ id: "rice", nameEn: "Rice", exchangeType: "cereal" })
const palak = makeFood({ id: "palak", nameEn: "Palak", exchangeType: "vegetable_a" })
const bhindi = makeFood({ id: "bhindi", nameEn: "Bhindi", exchangeType: "vegetable_a" })
const moongDal = makeFood({ id: "moong_dal", nameEn: "Moong Dal", exchangeType: "pulse" })

const input: FoodSelectorInput = {
  region: "north_indian",
  dietType: "vegetarian",
  mealCount: 5,
  skeleton: {
    breakfast: [{ exchangeType: "cereal", count: 2 }],
    dinner: [
      { exchangeType: "vegetable_a", count: 2 },
      { exchangeType: "pulse", count: 1 },
    ],
  },
  eligibleFoodsBySlot: {
    breakfast: { cereal: [roti, rice] },
    dinner: { vegetable_a: [palak, bhindi], pulse: [moongDal] },
  },
}

describe("fallbackSelection", () => {
  const selection = fallbackSelection(input)

  it("produces exactly 7 days, 0-indexed", () => {
    expect(selection.days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("every day's exchange totals match the skeleton exactly", () => {
    for (const day of selection.days) {
      for (const [slot, items] of Object.entries(input.skeleton)) {
        const meal = day.meals.find((m) => m.slot === slot)
        expect(meal, `day ${day.dayIndex} missing slot ${slot}`).toBeDefined()
        for (const skeletonItem of items) {
          const total = meal!.items
            .filter((i) => i.exchangeType === skeletonItem.exchangeType)
            .reduce((sum, i) => sum + i.exchangeCount, 0)
          expect(total, `day ${day.dayIndex} ${slot} ${skeletonItem.exchangeType}`).toBe(skeletonItem.count)
        }
      }
    }
  })

  it("splits a splittable type (vegetable_a) with count >= 2 across 2 distinct foods", () => {
    for (const day of selection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems).toHaveLength(2)
      expect(new Set(vegAItems.map((i) => i.foodId)).size).toBe(2)
      expect(vegAItems.every((i) => i.exchangeCount === 1)).toBe(true)
    }
  })

  it("does not split a non-splittable type (cereal) even at count >= 2", () => {
    for (const day of selection.days) {
      const breakfast = day.meals.find((m) => m.slot === "breakfast")!
      const cerealItems = breakfast.items.filter((i) => i.exchangeType === "cereal")
      expect(cerealItems).toHaveLength(1)
      expect(cerealItems[0].exchangeCount).toBe(2)
    }
  })

  it("rotates the cereal food across days rather than repeating the same one every day", () => {
    const foodIdsByDay = selection.days.map(
      (d) => d.meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "cereal")!.foodId
    )
    expect(new Set(foodIdsByDay).size).toBeGreaterThan(1)
  })

  it("is deterministic — same input produces identical output", () => {
    const again = fallbackSelection(input)
    expect(again).toEqual(selection)
  })

  it("throws when a skeleton exchange type has no eligible foods at all", () => {
    const broken: FoodSelectorInput = {
      ...input,
      eligibleFoodsBySlot: { breakfast: { cereal: [roti, rice] }, dinner: { vegetable_a: [palak, bhindi], pulse: [] } },
    }
    expect(() => fallbackSelection(broken)).toThrow()
  })
})
