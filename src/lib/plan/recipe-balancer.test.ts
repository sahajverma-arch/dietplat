import { describe, expect, it } from "vitest"

import { balanceDayToTargets } from "./recipe-balancer"
import { makeRecipe } from "./test-fixtures"
import type { GroundedRecipeDay } from "./recipe-types"

function makeDay(items: { recipe: ReturnType<typeof makeRecipe>; grams: number }[]): GroundedRecipeDay {
  return {
    dayIndex: 0,
    meals: [{ slot: "lunch", items }],
    totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
    cappedRecipeNames: [],
    unknownRecipeNames: [],
  }
}

describe("balanceDayToTargets", () => {
  it("converges toward an exactly-reachable target within realistic serving ranges", () => {
    const dal = makeRecipe({ name: "Dal", proteinPer100G: 7, carbsPer100G: 17, fatPer100G: 1.5, fiberPer100G: 5, minGrams: 50, maxGrams: 400, idealGrams: 150 })
    const rice = makeRecipe({ name: "Rice", proteinPer100G: 7, carbsPer100G: 28, fatPer100G: 1, fiberPer100G: 1, minGrams: 50, maxGrams: 400, idealGrams: 150 })
    const day = makeDay([
      { recipe: dal, grams: dal.idealGrams },
      { recipe: rice, grams: rice.idealGrams },
    ])
    // Exactly reachable at dal=200g, rice=100g (7p/17c/1.5f/5fib + 7p/28c/1f/1fib
    // per 100g respectively) — both well within bounds — so a correct
    // solver should land very close to it: protein 14+7=21, carbs 34+28=62,
    // fat 3+1=4, fiber 10+1=11, kcal 21*4+62*4+4*9=368.
    const target = { kcal: 368, proteinG: 21, carbsG: 62, fatG: 4, fiberG: 11 }
    const balanced = balanceDayToTargets(day, target)

    expect(Math.abs(balanced.totals.kcal - target.kcal) / target.kcal).toBeLessThan(0.05)
    expect(Math.abs(balanced.totals.proteinG - target.proteinG) / target.proteinG).toBeLessThan(0.1)
  })

  it("clamps every item to its own realistic [min, max] range, never exceeding it", () => {
    const dal = makeRecipe({ name: "Dal", proteinPer100G: 7, carbsPer100G: 17, fatPer100G: 1, fiberPer100G: 5, minGrams: 50, maxGrams: 100, idealGrams: 75 })
    const day = makeDay([{ recipe: dal, grams: dal.idealGrams }])
    // An unreachable target forces the item to its cap.
    const target = { kcal: 5000, proteinG: 300, carbsG: 800, fatG: 200, fiberG: 100 }
    const balanced = balanceDayToTargets(day, target)
    const grams = balanced.meals[0].items[0].grams
    expect(grams).toBeLessThanOrEqual(100)
    expect(grams).toBeGreaterThanOrEqual(50)
  })

  it("records a capped recipe when it hits its limit without closing the gap", () => {
    const dal = makeRecipe({ name: "Dal", proteinPer100G: 7, carbsPer100G: 17, fatPer100G: 1, fiberPer100G: 5, minGrams: 50, maxGrams: 100, idealGrams: 75 })
    const day = makeDay([{ recipe: dal, grams: dal.idealGrams }])
    const target = { kcal: 5000, proteinG: 300, carbsG: 800, fatG: 200, fiberG: 100 }
    const balanced = balanceDayToTargets(day, target)
    expect(balanced.cappedRecipeNames).toContain("Dal")
  })

  it("rounds every final gram figure to the nearest 5g", () => {
    const dal = makeRecipe({ name: "Dal", minGrams: 50, maxGrams: 400, idealGrams: 150 })
    const day = makeDay([{ recipe: dal, grams: dal.idealGrams }])
    const balanced = balanceDayToTargets(day, { kcal: 300, proteinG: 15, carbsG: 40, fatG: 5, fiberG: 5 })
    expect(balanced.meals[0].items[0].grams % 5).toBe(0)
  })

  it("returns zero totals unchanged for a day with no items", () => {
    const day = makeDay([])
    const balanced = balanceDayToTargets(day, { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 })
    expect(balanced.totals).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
  })
})
