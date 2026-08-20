import { describe, expect, it } from "vitest"

import { describeMacroProblems, fiberDeviationPct, isRecipeDayOffTarget, isRecipeWeekOffTarget, RECIPE_MACRO_TOLERANCE } from "./recipe-validate"

const target = { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }

describe("isRecipeDayOffTarget", () => {
  it("is false when every macro is within tolerance", () => {
    expect(isRecipeDayOffTarget({ kcal: 2050, proteinG: 98, carbsG: 205, fatG: 61, fiberG: 30 }, target)).toBe(false)
  })

  it("is true when kcal exceeds tolerance", () => {
    const achieved = { kcal: target.kcal * (1 + RECIPE_MACRO_TOLERANCE + 0.01), proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }
    expect(isRecipeDayOffTarget(achieved, target)).toBe(true)
  })

  it("ignores fiber entirely — a huge fiber miss alone never triggers it", () => {
    expect(isRecipeDayOffTarget({ kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 5 }, target)).toBe(false)
  })
})

describe("fiberDeviationPct", () => {
  it("computes a real deviation, informational only", () => {
    expect(fiberDeviationPct({ kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 15 }, target)).toBeCloseTo(0.5)
  })
})

describe("describeMacroProblems", () => {
  it("names each macro that's off, with direction", () => {
    const achieved = { kcal: 2000, proteinG: 50, carbsG: 200, fatG: 60, fiberG: 30 }
    const problems = describeMacroProblems(achieved, target)
    expect(problems.some((p) => p.includes("protein") && p.includes("under"))).toBe(true)
    expect(problems.some((p) => p.includes("kcal"))).toBe(false)
  })

  it("returns empty when nothing is off", () => {
    expect(describeMacroProblems({ kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }, target)).toEqual([])
  })
})

describe("isRecipeWeekOffTarget", () => {
  it("mirrors isRecipeDayOffTarget's logic for a weekly-average input", () => {
    expect(isRecipeWeekOffTarget({ kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 }, target)).toBe(false)
  })
})
