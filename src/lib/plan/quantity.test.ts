import { describe, expect, it } from "vitest"

import {
  ExchangeTypeMismatchError,
  PricedSelectionDeviationError,
  UnknownFoodError,
  assertWithinTolerance,
  priceSelection,
} from "./quantity"
import { makeFood } from "./test-fixtures"
import type { Selection } from "./food-selector-types"
import type { WeekTargets } from "@/lib/counselling/roadmap"

// cereal exchange = protein 2, carbs 15, fat 0 -> kcal 68
// pulse exchange  = protein 7, carbs 17, fat 0 -> kcal 96
// fruit exchange  = protein 0, carbs 10, fat 0 -> kcal 40
// fat exchange    = protein 0, carbs 0,  fat 5 -> kcal 45
const roti = makeFood({ id: "roti", exchangeType: "cereal", exchangeUnits: 1, servingRawG: 20 })
const moongDal = makeFood({ id: "dal", exchangeType: "pulse", exchangeUnits: 2, servingRawG: 60 }) // 1 exchange = 30g raw
const banana = makeFood({ id: "banana", exchangeType: "fruit", exchangeUnits: 1, servingRawG: null, householdMeasure: "1 medium" })
const ghee = makeFood({ id: "ghee", exchangeType: "fat", exchangeUnits: 1, servingRawG: 5 })

const foodsById = new Map([
  [roti.id, roti],
  [moongDal.id, moongDal],
  [banana.id, banana],
  [ghee.id, ghee],
])

const selection: Selection = {
  days: [
    {
      dayIndex: 0,
      meals: [
        {
          slot: "lunch",
          items: [
            { foodId: roti.id, exchangeType: "cereal", exchangeCount: 3 },
            { foodId: moongDal.id, exchangeType: "pulse", exchangeCount: 1 },
            { foodId: banana.id, exchangeType: "fruit", exchangeCount: 1 },
            { foodId: ghee.id, exchangeType: "fat", exchangeCount: 1 },
          ],
        },
      ],
    },
  ],
}

describe("priceSelection", () => {
  const priced = priceSelection(selection, foodsById)

  it("computes servingRawG as exchangeCount / exchangeUnits * food.servingRawG", () => {
    const items = priced.days[0].meals[0].items
    expect(items.find((i) => i.foodId === roti.id)?.servingRawG).toBe(60) // 3/1 * 20
    expect(items.find((i) => i.foodId === moongDal.id)?.servingRawG).toBe(30) // 1/2 * 60
  })

  it("leaves servingRawG null for foods with a variable raw amount (fruit)", () => {
    const items = priced.days[0].meals[0].items
    expect(items.find((i) => i.foodId === banana.id)?.servingRawG).toBeNull()
    expect(items.find((i) => i.foodId === banana.id)?.householdMeasure).toBe("1 medium")
  })

  it("recomputes achieved macros from exchange counts x Table 4.1, not from the foods", () => {
    expect(priced.days[0].achieved).toEqual({ kcal: 385, proteinG: 13, carbsG: 72, fatG: 5 })
  })

  it("throws UnknownFoodError for a food id not in the map", () => {
    const bad: Selection = {
      days: [{ dayIndex: 0, meals: [{ slot: "lunch", items: [{ foodId: "ghost", exchangeType: "cereal", exchangeCount: 1 }] }] }],
    }
    expect(() => priceSelection(bad, foodsById)).toThrow(UnknownFoodError)
  })

  it("throws ExchangeTypeMismatchError when the item's label disagrees with the food's real type", () => {
    const bad: Selection = {
      days: [{ dayIndex: 0, meals: [{ slot: "lunch", items: [{ foodId: roti.id, exchangeType: "pulse", exchangeCount: 1 }] }] }],
    }
    expect(() => priceSelection(bad, foodsById)).toThrow(ExchangeTypeMismatchError)
  })
})

describe("assertWithinTolerance", () => {
  const priced = priceSelection(selection, foodsById)

  it("passes and returns per-day deviations when achieved matches target closely", () => {
    const target: WeekTargets = { kcal: 385, proteinG: 13, carbsG: 72, fatG: 5, fibreG: 30 }
    const deviations = assertWithinTolerance(priced, target)
    expect(deviations).toHaveLength(1)
    expect(deviations[0].kcal).toBeCloseTo(0, 5)
  })

  it("throws PricedSelectionDeviationError when a day exceeds the tolerance", () => {
    const target: WeekTargets = { kcal: 1000, proteinG: 13, carbsG: 72, fatG: 5, fibreG: 30 }
    expect(() => assertWithinTolerance(priced, target)).toThrow(PricedSelectionDeviationError)
  })
})
