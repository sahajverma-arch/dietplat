import { describe, expect, it } from "vitest"

import { computeWeeklyAverage, pickBestWeek, weeklyDeviationScore } from "./recipe-week-score"
import type { DailyRecipeTarget, GroundedRecipeDay } from "./recipe-types"

const TARGET: DailyRecipeTarget = { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 60, fiberG: 30 }

/** A day carrying only the totals the score reads — meals/grounding are irrelevant here. */
function day(dayIndex: number, totals: Partial<DailyRecipeTarget>): GroundedRecipeDay {
  return {
    dayIndex,
    meals: [],
    totals: { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 60, fiberG: 30, ...totals },
    unknownRecipeNames: [],
    cappedRecipeNames: [],
  } as unknown as GroundedRecipeDay
}

/** 7 identical days, so the weekly average equals the per-day figure. */
function flatWeek(totals: Partial<DailyRecipeTarget>): GroundedRecipeDay[] {
  return Array.from({ length: 7 }, (_, i) => day(i, totals))
}

describe("computeWeeklyAverage", () => {
  it("averages across days rather than taking day 0", () => {
    const days = [day(0, { proteinG: 80 }), day(1, { proteinG: 120 })]
    expect(computeWeeklyAverage(days).proteinG).toBe(100)
  })

  it("does not divide by zero on an empty week", () => {
    expect(computeWeeklyAverage([]).kcal).toBe(0)
  })
})

describe("weeklyDeviationScore", () => {
  it("is 0 for a week exactly on target", () => {
    expect(weeklyDeviationScore(flatWeek({}), TARGET)).toBe(0)
  })

  it("returns a fraction, directly comparable to RECIPE_MACRO_TOLERANCE", () => {
    // protein 10% high, every other macro exact -> mean of (0, 0.1, 0, 0) = 0.025
    expect(weeklyDeviationScore(flatWeek({ proteinG: 110 }), TARGET)).toBeCloseTo(0.025, 6)
  })

  it("treats over and under target as equally bad", () => {
    const over = weeklyDeviationScore(flatWeek({ fatG: 66 }), TARGET)
    const under = weeklyDeviationScore(flatWeek({ fatG: 54 }), TARGET)
    expect(over).toBeCloseTo(under, 10)
  })

  it("ignores fiber, which is a soft target", () => {
    const wild = weeklyDeviationScore(flatWeek({ fiberG: 90 }), TARGET)
    expect(wild).toBe(0)
  })

  it("rewards days that cancel out, since the gate is the weekly average", () => {
    // One day 20g low on protein, one 20g high: the average is exactly on target.
    const balanced = [day(0, { proteinG: 80 }), day(1, { proteinG: 120 })]
    expect(weeklyDeviationScore(balanced, TARGET)).toBe(0)
  })
})

describe("pickBestWeek", () => {
  it("returns null when every attempt failed", () => {
    expect(pickBestWeek([], TARGET)).toBeNull()
  })

  it("picks the candidate closest to target, not the first", () => {
    const far = flatWeek({ proteinG: 130 })
    const near = flatWeek({ proteinG: 102 })
    const best = pickBestWeek([far, near], TARGET)
    expect(best?.index).toBe(1)
    expect(best?.days).toBe(near)
  })

  it("resolves ties to the earliest candidate, so the result is deterministic", () => {
    const a = flatWeek({ fatG: 66 })
    const b = flatWeek({ fatG: 54 }) // same absolute deviation, opposite direction
    expect(pickBestWeek([a, b], TARGET)?.index).toBe(0)
    expect(pickBestWeek([b, a], TARGET)?.index).toBe(0)
  })

  it("prefers a candidate that CLEARS the gate over a lower-scoring one that fails", () => {
    // Failing week: mean looks decent, but fat alone is 20% out — over the
    // 8% per-macro tolerance the gate actually checks. This is the real
    // observed shape (a 3.84% mean that still failed).
    const lowerMeanButFails = flatWeek({ fatG: 72 }) // mean 0.05, but fat 20% out -> FAILS
    // Passing week: every macro 7% out — inside the 8% gate — but a WORSE
    // mean (0.07) than the failing candidate above.
    const higherMeanButPasses = flatWeek({ kcal: 2140, proteinG: 107, carbsG: 267.5, fatG: 64.2 })

    expect(weeklyDeviationScore(lowerMeanButFails, TARGET)).toBeLessThan(
      weeklyDeviationScore(higherMeanButPasses, TARGET)
    )

    const best = pickBestWeek([lowerMeanButFails, higherMeanButPasses], TARGET)
    expect(best?.passes).toBe(true)
    expect(best?.days).toBe(higherMeanButPasses)
  })

  it("still ranks by score when candidates agree on passing", () => {
    const worse = flatWeek({ proteinG: 106 })
    const better = flatWeek({ proteinG: 101 })
    const best = pickBestWeek([worse, better], TARGET)
    expect(best?.passes).toBe(true)
    expect(best?.days).toBe(better)
  })

  it("still returns the least-bad week when every candidate fails", () => {
    const bad = flatWeek({ fatG: 90 })
    const worse = flatWeek({ fatG: 110 })
    const best = pickBestWeek([worse, bad], TARGET)
    expect(best?.passes).toBe(false)
    expect(best?.days).toBe(bad)
  })

  it("reports the winning score alongside the week", () => {
    const best = pickBestWeek([flatWeek({ proteinG: 110 })], TARGET)
    expect(best?.score).toBeCloseTo(0.025, 6)
  })
})
