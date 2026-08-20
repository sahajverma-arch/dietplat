import { describe, expect, it } from "vitest"

import { recipeSelectorFallback } from "./recipe-selector-fallback"
import { makeRecipe } from "./test-fixtures"
import type { RecipeForPrompt, RecipeSelectorInput } from "./recipe-types"

function toPrompt(r: ReturnType<typeof makeRecipe>): RecipeForPrompt {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    mainOrMid: r.mainOrMid as "main" | "mid",
    cuisine: r.cuisine,
    macroCategory: r.macroCategory,
    commonality: r.commonality,
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
})
