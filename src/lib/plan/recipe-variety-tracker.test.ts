import { describe, expect, it } from "vitest"

import { findDaysNeedingVarietyRetry, findVarietyViolations, MAX_RECIPE_REPEATS_PER_WEEK, trackRecipeUsage } from "./recipe-variety-tracker"
import { makeRecipe } from "./test-fixtures"
import type { GroundedRecipeDay } from "./recipe-types"

function makeDays(recipeNamePerDay: string[]): GroundedRecipeDay[] {
  const recipesByName = new Map<string, ReturnType<typeof makeRecipe>>()
  return recipeNamePerDay.map((name, dayIndex) => {
    let recipe = recipesByName.get(name)
    if (!recipe) {
      recipe = makeRecipe({ id: name, name })
      recipesByName.set(name, recipe)
    }
    return {
      dayIndex,
      meals: [{ slot: "lunch", items: [{ recipe, grams: 100 }] }],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      cappedRecipeNames: [],
      unknownRecipeNames: [],
    }
  })
}

describe("trackRecipeUsage / findVarietyViolations", () => {
  it("counts usage per recipe across the week", () => {
    const days = makeDays(["A", "B", "A", "C", "A", "B", "D"])
    const usage = trackRecipeUsage(days)
    expect(usage.get("A")).toBe(3)
    expect(usage.get("B")).toBe(2)
  })

  it("flags a recipe used more than MAX_RECIPE_REPEATS_PER_WEEK times", () => {
    const days = makeDays(["A", "A", "A", "B", "C", "D", "E"])
    const violations = findVarietyViolations(days)
    expect(violations).toHaveLength(1)
    expect(violations[0].name).toBe("A")
    expect(violations[0].count).toBe(3)
  })

  it("does not flag a recipe used exactly at the cap", () => {
    const days = makeDays(Array.from({ length: MAX_RECIPE_REPEATS_PER_WEEK }, () => "A").concat(["B", "C", "D", "E"]))
    expect(findVarietyViolations(days)).toEqual([])
  })
})

describe("findDaysNeedingVarietyRetry", () => {
  it("flags only the day(s) where a recipe's count first exceeds the cap, in day order", () => {
    const days = makeDays(["A", "A", "A", "B", "C", "D", "E"])
    const flagged = findDaysNeedingVarietyRetry(days)
    // 3rd occurrence of A is on dayIndex 2 — that's the one that pushed the count over the cap.
    expect(flagged.has(2)).toBe(true)
    expect(flagged.has(0)).toBe(false)
    expect(flagged.has(1)).toBe(false)
  })

  it("returns an empty set when nothing exceeds the cap", () => {
    const days = makeDays(["A", "B", "C", "D", "E", "F", "G"])
    expect(findDaysNeedingVarietyRetry(days).size).toBe(0)
  })
})
