import { describe, expect, it } from "vitest"

import { recipeSelectorFallback } from "./recipe-selector-fallback"
import { makeRecipe } from "./test-fixtures"
import type { RecipeForPrompt, RecipeSelectorInput } from "./recipe-types"

function toPrompt(r: ReturnType<typeof makeRecipe>): RecipeForPrompt {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    consistency: r.consistency,
    mainOrMid: r.mainOrMid as "main" | "mid",
    cuisine: r.cuisine,
    macroCategory: r.macroCategory,
    commonality: r.commonality,
    mustHaveCategories: r.mustHaveCategories,
    goodToHaveCategories: r.goodToHaveCategories,
    mustHaveRecipeNames: r.mustHaveRecipeNames,
    goodToHaveRecipeNames: r.goodToHaveRecipeNames,
    proteinPer100G: r.proteinPer100G,
    carbsPer100G: r.carbsPer100G,
    fatPer100G: r.fatPer100G,
    fiberPer100G: r.fiberPer100G,
    kcalPer100G: r.kcalPer100G,
  }
}

function baseInput(recipes: ReturnType<typeof makeRecipe>[], dietType = "vegetarian"): RecipeSelectorInput {
  return {
    cuisine: "General",
    dietType: dietType as RecipeSelectorInput["dietType"],
    mealCount: 3,
    dailyTarget: { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 },
    slots: [
      { slot: "breakfast", slotOrder: 1, timeHint: null },
      { slot: "lunch", slotOrder: 2, timeHint: null },
      { slot: "dinner", slotOrder: 3, timeHint: null },
    ],
    eligibleRecipesForPrompt: recipes.map(toPrompt),
    allRecipesById: new Map(recipes.map((r) => [r.id, r])),
    eligibleCuisines: ["General"],
    clientAllergenTags: [],
    aliasRows: [],
  }
}

describe("recipeSelectorFallback", () => {
  it("produces a full 7-day selection with at least one item per slot", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Roti", category: "Bread" }),
      makeRecipe({ id: "2", name: "Dal", category: "Dal Curry" }),
      makeRecipe({ id: "3", name: "Rice", category: "Rice" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes))
    expect(selection.days).toHaveLength(7)
    for (const day of selection.days) {
      for (const meal of day.meals) {
        expect(meal.items.length).toBeGreaterThan(0)
      }
    }
  })

  it("is deterministic for the same inputs", () => {
    const recipes = [makeRecipe({ id: "1", name: "Roti", category: "Bread" }), makeRecipe({ id: "2", name: "Dal", category: "Dal Curry" })]
    const a = recipeSelectorFallback(baseInput(recipes))
    const b = recipeSelectorFallback(baseInput(recipes))
    expect(a).toEqual(b)
  })

  it("always gives non-vegetarian dinner a real non-veg pick when one is eligible", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Roti", category: "Bread" }),
      makeRecipe({ id: "2", name: "Dal", category: "Dal Curry" }),
      makeRecipe({ id: "3", name: "Chicken Curry", category: "Heavy Meal", dietTypes: ["non_vegetarian"] }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes, "non_vegetarian"))
    for (const day of selection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      expect(dinner.items.some((i) => i.name === "Chicken Curry")).toBe(true)
    }
  })

  it("respects dayIndexOffset so consecutive weeks don't repeat the exact same rotation phase", () => {
    const recipes = [makeRecipe({ id: "1", name: "A" }), makeRecipe({ id: "2", name: "B" }), makeRecipe({ id: "3", name: "C" })]
    const week1 = recipeSelectorFallback(baseInput(recipes))
    const week2 = recipeSelectorFallback({ ...baseInput(recipes), dayIndexOffset: 7 })
    expect(week1).not.toEqual(week2)
  })

  it("repairs an unsatisfied 'must have' pairing by adding a real companion from the pool", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Veg Pulao", category: "Pulao", mustHaveCategories: ["Raita"] }),
      makeRecipe({ id: "2", name: "Dal", category: "Dal Curry" }),
      makeRecipe({ id: "3", name: "Sabzi", category: "Sabzi" }),
      makeRecipe({ id: "4", name: "Raita", category: "Raita" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes))
    // Veg Pulao is the pool's only rice_pulao-bucket recipe, so it's picked every day (rotation over a pool of 1).
    for (const day of selection.days) {
      const lunch = day.meals.find((m) => m.slot === "lunch")!
      expect(lunch.items.some((i) => i.name === "Veg Pulao")).toBe(true)
      expect(lunch.items.some((i) => i.name === "Raita")).toBe(true)
    }
  })

  it("leaves a 'must have' requirement unmet, without inventing a companion, when the pool has none eligible", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Veg Pulao", category: "Pulao", mustHaveCategories: ["Raita"] }),
      makeRecipe({ id: "2", name: "Dal", category: "Dal Curry" }),
      makeRecipe({ id: "3", name: "Sabzi", category: "Sabzi" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes))
    const lunch = selection.days[0].meals.find((m) => m.slot === "lunch")!
    expect(lunch.items.map((i) => i.name)).toEqual(["Veg Pulao", "Dal", "Sabzi"])
  })

  it("removes a redundant staple when the dal_curry pick turns out to be a self-contained dish (Khichdi) — real regression: 'no one eats ajwain paratha with khichdi'", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Plain Rice", category: "Rice" }),
      makeRecipe({ id: "2", name: "Sweet And Salty Khichdi", category: "Khichdi" }),
      makeRecipe({ id: "3", name: "Sabzi", category: "Sabzi" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes))
    const lunch = selection.days[0].meals.find((m) => m.slot === "lunch")!
    expect(lunch.items.some((i) => i.name === "Sweet And Salty Khichdi")).toBe(true)
    expect(lunch.items.some((i) => i.name === "Plain Rice")).toBe(false)
  })

  it("does NOT remove the staple when the Heavy Meal pick is a zero-carb protein main (Roasted Chicken), not a real composite dish", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Roti", category: "Roti" }),
      makeRecipe({ id: "2", name: "Roasted Chicken", category: "Heavy Meal", carbsPer100G: 0, dietTypes: ["non_vegetarian"] }),
      makeRecipe({ id: "3", name: "Sabzi", category: "Sabzi" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes, "non_vegetarian"))
    const dinner = selection.days[0].meals.find((m) => m.slot === "dinner")!
    expect(dinner.items.some((i) => i.name === "Roasted Chicken")).toBe(true)
    expect(dinner.items.some((i) => i.name === "Roti")).toBe(true)
  })

  it("does NOT re-add a sabzi/dal companion via the must-have repair pass when a real non-veg dish is present — the meat substitutes for it, matching recipe-plausibility-validate.ts's own exemption ('we cant give chicken like things meat with any sabzi and dal')", () => {
    const recipes = [
      makeRecipe({ id: "1", name: "Wheat Bran Roti", category: "Roti", mustHaveCategories: ["Sabzi", "High Protein Sabzi", "Dal", "Curry"] }),
      makeRecipe({ id: "2", name: "Roasted Chicken", category: "Heavy Meal", carbsPer100G: 0, dietTypes: ["non_vegetarian"] }),
      makeRecipe({ id: "3", name: "Sabzi", category: "Sabzi" }),
    ]
    const selection = recipeSelectorFallback(baseInput(recipes, "non_vegetarian"))
    const dinner = selection.days[0].meals.find((m) => m.slot === "dinner")!
    expect(dinner.items.some((i) => i.name === "Roasted Chicken")).toBe(true)
    expect(dinner.items.some((i) => i.name === "Wheat Bran Roti")).toBe(true)
    expect(dinner.items.some((i) => i.name === "Sabzi")).toBe(false)
  })
})
