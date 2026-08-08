import { describe, expect, it } from "vitest"
import { solveExchanges, type SolverInput } from "./exchange-solver"

function expectWithinTolerance(result: ReturnType<typeof solveExchanges>) {
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.deviation.kcal).toBeLessThan(0.015)
  expect(result.deviation.proteinG).toBeLessThan(0.015)
  expect(result.deviation.fatG).toBeLessThan(0.015)
  expect(result.deviation.carbsG).toBeLessThan(0.015)
}

describe("solveExchanges — real plan reproduction (Deepak Sharma, maintenance)", () => {
  const input: SolverInput = {
    kcal: 2618,
    proteinG: 73,
    fatG: 76,
    carbsG: 411,
    fibreG: 30,
    dietType: "vegetarian",
  }
  const result = solveExchanges(input)

  it("clears 1.5% deviation on every macro", () => {
    expectWithinTolerance(result)
  })

  it("lands close to the real decoded skeleton (18 cereal, 2 milk_cow, 2 pulse, 3 veg_a, 2 veg_b, 6 fruit, 11 fat)", () => {
    if (!result.ok) throw new Error("solver failed")
    // Not an exact match requirement (the solver explores its own search
    // space independently) — but should be in the same neighbourhood as
    // what actually shipped, since it targets the same numbers.
    expect(result.exchangeCounts.cereal).toBeGreaterThan(14)
    expect(result.exchangeCounts.cereal).toBeLessThan(22)
    expect(result.exchangeCounts.milk_cow).toBe(2)
    expect(result.exchangeCounts.meat).toBe(0)
    expect(result.exchangeCounts.meat_lean).toBe(0)
    expect(result.exchangeCounts.vegetable_a).toBeGreaterThanOrEqual(4)
    expect(result.exchangeCounts.vegetable_b).toBeGreaterThanOrEqual(2)
    expect(result.exchangeCounts.fruit).toBeGreaterThanOrEqual(3)
    expect(result.exchangeCounts.sugar).toBe(0)
  })
})

describe("solveExchanges — all four roadmap categories' week-1 targets", () => {
  it("Priya (TEST-001): 1775 kcal / P55 / F52 / C272, vegetarian", () => {
    expectWithinTolerance(
      solveExchanges({ kcal: 1775, proteinG: 55, fatG: 52, carbsG: 272, fibreG: 30, dietType: "vegetarian" })
    )
  })

  it("Sneha (TEST-003): 1459 kcal / P73 / F48 / C184, eggetarian (per the real worked example)", () => {
    expectWithinTolerance(
      solveExchanges({ kcal: 1459, proteinG: 73, fatG: 48, carbsG: 184, fibreG: 30, dietType: "eggetarian" })
    )
  })

  it("Rahul (TEST-002): 2339 kcal / P108 / F58 / C346, non-vegetarian", () => {
    expectWithinTolerance(
      solveExchanges({ kcal: 2339, proteinG: 108, fatG: 58, carbsG: 346, fibreG: 31, dietType: "non_vegetarian" })
    )
  })

  it("Aadi (TEST-004): 2083 kcal / P88 / F63 / C291, eggetarian", () => {
    expectWithinTolerance(
      solveExchanges({ kcal: 2083, proteinG: 88, fatG: 63, carbsG: 291, fibreG: 34, dietType: "eggetarian" })
    )
  })
})

describe("solveExchanges — diet type behaviour", () => {
  // A moderate protein:carb ratio, comfortably achievable by every diet
  // type on Table 4.1 alone — unlike the high-protein/low-carb corner
  // explored in the acceptance tests below, this isn't meant to probe
  // feasibility, just the anchor rules. Counts are read from `best` when
  // `ok` is false too, since the anchor rules (milk_cow=0 for vegan,
  // meat=0 for vegetarian, sugar off by default) apply unconditionally,
  // not only on a successful solve.
  const base = { kcal: 1900, proteinG: 65, fatG: 55, carbsG: 286, fibreG: 30 }

  function countsOf(result: ReturnType<typeof solveExchanges>) {
    return result.ok ? result.exchangeCounts : result.best.exchangeCounts
  }

  it("vegan carries zero milk_cow/meat/meat_lean and a raised pulse floor", () => {
    const counts = countsOf(solveExchanges({ ...base, dietType: "vegan" }))
    expect(counts.milk_cow).toBe(0)
    expect(counts.meat).toBe(0)
    expect(counts.meat_lean).toBe(0)
    expect(counts.pulse).toBeGreaterThanOrEqual(2)
  })

  it("vegetarian never uses meat or meat_lean", () => {
    const counts = countsOf(solveExchanges({ ...base, dietType: "vegetarian" }))
    expect(counts.meat).toBe(0)
    expect(counts.meat_lean).toBe(0)
  })

  it("sugar is 0 unless explicitly enabled", () => {
    const off = countsOf(solveExchanges({ ...base, dietType: "vegetarian" }))
    const on = countsOf(solveExchanges({ ...base, dietType: "vegetarian", sugarEnabled: true }))
    expect(off.sugar).toBe(0)
    expect(on.sugar).toBe(1)
  })
})

describe("solveExchanges — floors always hold", () => {
  it("vegetable_a >= 4, vegetable_b >= 2, fruit >= 3 even at a low calorie target", () => {
    const result = solveExchanges({
      kcal: 1300,
      proteinG: 70,
      fatG: 40,
      carbsG: 130,
      fibreG: 30,
      dietType: "vegetarian",
    })
    expect(result.ok || !result.ok).toBe(true) // either branch still carries floors
    const counts = result.ok ? result.exchangeCounts : result.best.exchangeCounts
    expect(counts.vegetable_a).toBeGreaterThanOrEqual(4)
    expect(counts.vegetable_b).toBeGreaterThanOrEqual(2)
    expect(counts.fruit).toBeGreaterThanOrEqual(3)
  })
})
