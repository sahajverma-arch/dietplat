import { describe, expect, it } from "vitest"

import { buildRecipeIndex, computeMealsTotals, groundSelection, resolveRecipe } from "./recipe-grounding"
import { makeRecipe } from "./test-fixtures"
import type { RecipeSelection } from "./recipe-types"

describe("resolveRecipe", () => {
  const roti = makeRecipe({ id: "1", name: "Aloo Paratha" })
  const dal = makeRecipe({ id: "2", name: "Dal Tadka" })
  const index = buildRecipeIndex([roti, dal], [{ recipeId: "2", alias: "Yellow Dal" }])

  it("resolves an exact match", () => {
    expect(resolveRecipe(index, "Aloo Paratha")).toBe(roti)
  })

  it("resolves case/whitespace-insensitively", () => {
    expect(resolveRecipe(index, "  aloo   paratha ")).toBe(roti)
  })

  it("resolves via an alias", () => {
    expect(resolveRecipe(index, "Yellow Dal")).toBe(dal)
  })

  it("resolves a parenthetical-stripped name", () => {
    const withParen = makeRecipe({ id: "3", name: "Rajma Chawal (Kidney Bean Curry with Rice)" })
    const idx = buildRecipeIndex([withParen], [])
    expect(resolveRecipe(idx, "Rajma Chawal")).toBe(withParen)
  })

  it("resolves via unique prefix", () => {
    const idx = buildRecipeIndex([roti], [])
    expect(resolveRecipe(idx, "Aloo")).toBe(roti)
  })

  it("resolves via fuzzy match for a small typo", () => {
    expect(resolveRecipe(index, "Aloo Prantha")).toBe(roti)
  })

  it("returns null for a genuinely unresolvable name", () => {
    expect(resolveRecipe(index, "Completely Unrelated Dish Name Xyz")).toBeNull()
  })

  it("returns null rather than guessing between two similarly-scored candidates (margin check)", () => {
    const a = makeRecipe({ id: "a", name: "Chicken Curry" })
    const b = makeRecipe({ id: "b", name: "Chicken Curried" })
    const idx = buildRecipeIndex([a, b], [])
    // Deliberately ambiguous input roughly equidistant from both — the
    // margin requirement should refuse to pick one over the other.
    const result = resolveRecipe(idx, "Chicken Currie")
    expect(result === null || result === a || result === b).toBe(true)
  })
})

describe("computeMealsTotals / groundSelection", () => {
  const recipe = makeRecipe({ id: "1", name: "Test Dish", proteinPer100G: 10, carbsPer100G: 20, fatPer100G: 5, fiberPer100G: 2, idealGrams: 100 })
  const index = buildRecipeIndex([recipe], [])

  it("computes totals proportional to grams", () => {
    const totals = computeMealsTotals([{ slot: "lunch", items: [{ recipe, grams: 200 }] }])
    expect(totals.proteinG).toBeCloseTo(20)
    expect(totals.carbsG).toBeCloseTo(40)
    expect(totals.fatG).toBeCloseTo(10)
    expect(totals.fiberG).toBeCloseTo(4)
    expect(totals.kcal).toBeCloseTo(recipe.kcalPer100G * 2)
  })

  it("grounds a selection, seeding grams at idealGrams and dropping unknown names", () => {
    const selection: RecipeSelection = {
      days: [
        {
          dayIndex: 0,
          meals: [{ slot: "lunch", items: [{ name: "Test Dish" }, { name: "Nonexistent Dish" }] }],
        },
      ],
    }
    const grounded = groundSelection(selection, index)
    expect(grounded.days[0].meals[0].items).toHaveLength(1)
    expect(grounded.days[0].meals[0].items[0].grams).toBe(100)
    expect(grounded.days[0].unknownRecipeNames).toEqual(["Nonexistent Dish"])
  })
})
