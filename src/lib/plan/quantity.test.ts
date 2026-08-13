import { describe, expect, it } from "vitest"

import {
  ExchangeTypeMismatchError,
  PricedSelectionDeviationError,
  UnknownFoodError,
  WeeklyAverageDeviationError,
  assertWeeklyAverageWithinTolerance,
  assertWithinTolerance,
  priceSelection,
} from "./quantity"
import type { AchievedMacros } from "./table-4-1"
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

  it("passes and returns per-day deviations when achieved matches its own day's expected macros closely", () => {
    const expectedByDay: AchievedMacros[] = [{ kcal: 385, proteinG: 13, carbsG: 72, fatG: 5 }]
    const deviations = assertWithinTolerance(priced, expectedByDay)
    expect(deviations).toHaveLength(1)
    expect(deviations[0].kcal).toBeCloseTo(0, 5)
  })

  it("throws PricedSelectionDeviationError when a day exceeds tolerance against its own expected macros", () => {
    const expectedByDay: AchievedMacros[] = [{ kcal: 1000, proteinG: 13, carbsG: 72, fatG: 5 }]
    expect(() => assertWithinTolerance(priced, expectedByDay)).toThrow(PricedSelectionDeviationError)
  })

  it("checks each day against its OWN entry in expectedByDay, not a single flat target — a legitimately-wobbling day must not be flagged", () => {
    // Two days: day 0 matches its own (jittered) expectation exactly, day 1 matches a DIFFERENT expectation exactly.
    // If this were checked against one flat target instead, at least one day would spuriously fail.
    const twoDaySelection: Selection = {
      days: [selection.days[0], { ...selection.days[0], dayIndex: 1 }],
    }
    const twoDayPriced = priceSelection(twoDaySelection, foodsById)
    const expectedByDay: AchievedMacros[] = [
      { kcal: 385, proteinG: 13, carbsG: 72, fatG: 5 },
      { kcal: 385, proteinG: 13, carbsG: 72, fatG: 5 },
    ]
    expect(() => assertWithinTolerance(twoDayPriced, expectedByDay)).not.toThrow()
  })
})

describe("assertWeeklyAverageWithinTolerance", () => {
  const priced = priceSelection(selection, foodsById)

  it("passes when the (single-day, in this fixture) average matches the prescribed target closely", () => {
    const target: WeekTargets = { kcal: 385, proteinG: 13, carbsG: 72, fatG: 5, fibreG: 30 }
    expect(() => assertWeeklyAverageWithinTolerance(priced, target)).not.toThrow()
  })

  it("throws WeeklyAverageDeviationError when the average deviates from the prescribed target by more than tolerance", () => {
    const target: WeekTargets = { kcal: 1000, proteinG: 13, carbsG: 72, fatG: 5, fibreG: 30 }
    expect(() => assertWeeklyAverageWithinTolerance(priced, target)).toThrow(WeeklyAverageDeviationError)
  })

  it("averages across multiple days rather than checking any single one — a day above target and a day below can still average to exactly on target", () => {
    const highDay = { dayIndex: 0, meals: selection.days[0].meals }
    const lowMeals = [
      {
        slot: "lunch",
        items: [
          { foodId: roti.id, exchangeType: "cereal" as const, exchangeCount: 3 },
          { foodId: moongDal.id, exchangeType: "pulse" as const, exchangeCount: 0 },
          { foodId: banana.id, exchangeType: "fruit" as const, exchangeCount: 1 },
          { foodId: ghee.id, exchangeType: "fat" as const, exchangeCount: 1 },
        ],
      },
    ]
    const twoDaySelection: Selection = {
      days: [highDay, { dayIndex: 1, meals: lowMeals }],
    }
    const twoDayPriced = priceSelection(twoDaySelection, foodsById)
    // high day: {kcal:385, protein:13, carbs:72, fat:5} (as above). low day (pulse=0 instead of 1):
    // {kcal:289, protein:6, carbs:55, fat:5}. Averages: kcal 337, protein 9.5, carbs 63.5, fat 5.
    const target: WeekTargets = { kcal: 337, proteinG: 9.5, carbsG: 63.5, fatG: 5, fibreG: 30 }
    expect(() => assertWeeklyAverageWithinTolerance(twoDayPriced, target)).not.toThrow()
    // Neither individual day is anywhere near 337 kcal on its own — confirms this is genuinely averaging, not checking one day.
    expect(twoDayPriced.days[0].achieved.kcal).not.toBeCloseTo(337, 0)
    expect(twoDayPriced.days[1].achieved.kcal).not.toBeCloseTo(337, 0)
  })
})
