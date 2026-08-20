import { describe, expect, it } from "vitest"

import { describePlausibilityProblems } from "./recipe-plausibility-validate"
import { makeRecipe } from "./test-fixtures"
import type { GroundedRecipeDay } from "./recipe-types"

const constraints = { dietType: "vegetarian", eligibleCuisines: ["General", "North Indian"], allergenTags: [] }

function makeDay(meals: GroundedRecipeDay["meals"]): GroundedRecipeDay {
  return { dayIndex: 0, meals, totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, cappedRecipeNames: [], unknownRecipeNames: [] }
}

describe("describePlausibilityProblems", () => {
  it("flags a structurally empty meal", () => {
    const day = makeDay([{ slot: "breakfast", items: [] }])
    expect(describePlausibilityProblems(day, constraints)).toEqual(["breakfast has no resolved items"])
  })

  it("flags a duplicate recipe within one meal", () => {
    const dal = makeRecipe({ name: "Dal" })
    const day = makeDay([{ slot: "lunch", items: [{ recipe: dal, grams: 100 }, { recipe: dal, grams: 50 }] }])
    const problems = describePlausibilityProblems(day, constraints)
    expect(problems.some((p) => p.includes("duplicate"))).toBe(true)
  })

  it("flags a real meal slot (lunch) with no MAIN item", () => {
    const side = makeRecipe({ name: "Side", mainOrMid: "mid" })
    const day = makeDay([{ slot: "lunch", items: [{ recipe: side, grams: 50 }] }])
    expect(describePlausibilityProblems(day, constraints).some((p) => p.includes("no MAIN"))).toBe(true)
  })

  it("does not require a MAIN item at mid_morning/evening/bedtime — snack-only occasions", () => {
    const snack = makeRecipe({ name: "Masala Chai", mainOrMid: "mid" })
    for (const slot of ["mid_morning", "evening", "bedtime"]) {
      const day = makeDay([{ slot, items: [{ recipe: snack, grams: 150 }] }])
      expect(describePlausibilityProblems(day, constraints).some((p) => p.includes("no MAIN")), slot).toBe(false)
    }
  })

  it("flags stacking two rich (heavy_meal/dessert) dishes in one meal", () => {
    const heavy1 = makeRecipe({ name: "Butter Chicken", category: "Heavy Meal", mainOrMid: "main" })
    const heavy2 = makeRecipe({ name: "Gulab Jamun", category: "Dessert", mainOrMid: "mid" })
    const day = makeDay([{ slot: "dinner", items: [{ recipe: heavy1, grams: 200 }, { recipe: heavy2, grams: 50 }] }])
    expect(describePlausibilityProblems(day, constraints).some((p) => p.includes("stacks"))).toBe(true)
  })

  it("flags a diet-type-ineligible recipe as a defense-in-depth check", () => {
    const meatDish = makeRecipe({ name: "Chicken Curry", dietTypes: ["non_vegetarian"] })
    const day = makeDay([{ slot: "lunch", items: [{ recipe: meatDish, grams: 100 }] }])
    expect(describePlausibilityProblems(day, constraints).some((p) => p.includes("not eligible for diet type"))).toBe(true)
  })

  it("flags a cuisine-ineligible recipe", () => {
    const foreign = makeRecipe({ name: "Sushi", cuisine: "Bengali" })
    const day = makeDay([{ slot: "lunch", items: [{ recipe: foreign, grams: 100 }] }])
    expect(describePlausibilityProblems(day, constraints).some((p) => p.includes("not eligible for the requested cuisine"))).toBe(true)
  })

  it("flags a recipe carrying a declared client allergen", () => {
    const nutty = makeRecipe({ name: "Peanut Chikki", allergenTags: ["peanuts"] })
    const day = makeDay([{ slot: "evening", items: [{ recipe: nutty, grams: 30 }] }])
    const withAllergy = { ...constraints, allergenTags: ["peanuts"] }
    expect(describePlausibilityProblems(day, withAllergy).some((p) => p.includes("declared allergen"))).toBe(true)
  })

  it("returns empty for a fully plausible day", () => {
    const main = makeRecipe({ name: "Dal", category: "Dal Curry", mainOrMid: "main" })
    const day = makeDay([{ slot: "lunch", items: [{ recipe: main, grams: 150 }] }])
    expect(describePlausibilityProblems(day, constraints)).toEqual([])
  })
})
