import { describe, expect, it } from "vitest"

import { getServingLimitsG } from "./recipe-serving-limits"
import { makeRecipe } from "./test-fixtures"

describe("getServingLimitsG", () => {
  it("reads min/max/ideal grams straight off the recipe row", () => {
    const recipe = makeRecipe({ minGrams: 80, maxGrams: 250, idealGrams: 150 })
    expect(getServingLimitsG(recipe)).toEqual({ min: 80, max: 250, ideal: 150 })
  })
})
