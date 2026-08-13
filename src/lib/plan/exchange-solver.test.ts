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

  it("lands close to the real decoded skeleton (18 cereal, 0 milk_cow, 2 pulse, 3 veg_a, 2 veg_b, 6 fruit, 11 fat)", () => {
    if (!result.ok) throw new Error("solver failed")
    // Not an exact match requirement (the solver explores its own search
    // space independently) — but should be in the same neighbourhood as
    // what actually shipped, since it targets the same numbers. milk_cow is
    // 0 here, not the real plan's 2: MILK_COW_CAP now fixes it at 0
    // exchanges for every diet type — a dietitian directive to default to
    // curd (milk_skim) over milk — with the solver's existing fat/pulse/
    // milk_skim flexibility absorbing the difference.
    expect(result.exchangeCounts.cereal).toBeGreaterThan(14)
    expect(result.exchangeCounts.cereal).toBeLessThan(22)
    expect(result.exchangeCounts.milk_cow).toBe(0)
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

  it("eggetarian prefers 2 eggs (meat = 2) on a comfortably achievable target, never zero", () => {
    const counts = countsOf(solveExchanges({ ...base, dietType: "eggetarian" }))
    expect(counts.meat).toBe(2)
    expect(counts.meat_lean).toBe(0)
  })

  it("non_vegetarian always carries at least one egg or lean-meat/fish exchange", () => {
    const counts = countsOf(solveExchanges({ ...base, dietType: "non_vegetarian" }))
    expect(counts.meat + counts.meat_lean).toBeGreaterThanOrEqual(1)
  })

  it("non_vegetarian prefers 2 real meat_lean exchanges (chicken/fish, ~70 g) when the target allows it", () => {
    // Distinct from eggetarian: a client tagged non-vegetarian rather than
    // eggetarian expects actual meat, not just eggs — eggetarian already
    // exists as its own diet type for egg-only clients. Rahul (TEST-002)'s
    // real target, not `base`: `base` happens to land exactly on a Table
    // 4.1 fat-grid gap for the meat_lean=2 tier (verified while building
    // this) and falls back — see the fallback test below for that case.
    const result = solveExchanges({ kcal: 2339, proteinG: 108, fatG: 58, carbsG: 346, fibreG: 31, dietType: "non_vegetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.exchangeCounts.meat_lean).toBe(2)
  })

  it("non_vegetarian falls back off the 2-meat_lean floor when it can't fit tolerance", () => {
    // Verified target: forcing meat_lean=2 alone overshoots protein by
    // ~19.4% here; the next tier (meat_lean 0-2, no longer mandatory at 2)
    // clears tolerance exactly with meat_lean=1.
    const result = solveExchanges({ kcal: 1200, proteinG: 36, fatG: 33, carbsG: 190, fibreG: 30, dietType: "non_vegetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.exchangeCounts.meat_lean).toBe(1)
    expect(result.exchangeCounts.meat).toBe(0)
  })

  it("eggetarian falls back to a single egg (meat = 1) when 2 eggs' fat/protein can't fit tolerance", () => {
    // Sneha (TEST-003)'s real target: 2 eggs pushes fat ~2.1% over the 1.5%
    // ceiling (verified while building this fallback), so the solver must
    // drop to the 1-egg tier to reproduce her real, historical plan.
    const result = solveExchanges({ kcal: 1459, proteinG: 73, fatG: 48, carbsG: 184, fibreG: 30, dietType: "eggetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.exchangeCounts.meat).toBe(1)
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

describe("solveExchanges — milk_cow defaults to 0, milk_skim (curd) fixed at 1 exchange/day (dietitian directive)", () => {
  const base = { kcal: 1900, proteinG: 65, fatG: 55, carbsG: 286, fibreG: 30 }

  function countsOf(result: ReturnType<typeof solveExchanges>) {
    return result.ok ? result.exchangeCounts : result.best.exchangeCounts
  }

  it("never uses milk_cow for any diet type — curd is the default dairy exchange, not milk", () => {
    for (const dietType of ["vegetarian", "eggetarian", "non_vegetarian", "jain", "vegan"] as const) {
      const counts = countsOf(solveExchanges({ ...base, dietType }))
      expect(counts.milk_cow, dietType).toBe(0)
    }
  })

  it("vegan still carries zero milk_cow AND zero milk_skim — no dairy exchange at all", () => {
    const counts = countsOf(solveExchanges({ ...base, dietType: "vegan" }))
    expect(counts.milk_cow).toBe(0)
    expect(counts.milk_skim).toBe(0)
  })

  it("fixes milk_skim at exactly 1 exchange (320 g curd, MILK_SKIM_CAP) for every non-vegan diet type — never searched as a range, same anchor role MILK_COW_CAP used to hold", () => {
    for (const dietType of ["vegetarian", "eggetarian", "non_vegetarian", "jain"] as const) {
      const counts = countsOf(solveExchanges({ ...base, dietType }))
      expect(counts.milk_skim, dietType).toBe(1)
    }
  })

  it("Deepak Sharma's real target (2618 kcal, vegetarian) still clears tolerance with milk_cow=0, compensated by milk_skim/fat/pulse flexibility", () => {
    const result = solveExchanges({ kcal: 2618, proteinG: 73, fatG: 76, carbsG: 411, fibreG: 30, dietType: "vegetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.exchangeCounts.milk_cow).toBe(0)
    expect(result.deviation.kcal).toBeLessThan(0.015)
    expect(result.deviation.proteinG).toBeLessThan(0.015)
    expect(result.deviation.fatG).toBeLessThan(0.015)
    expect(result.deviation.carbsG).toBeLessThan(0.015)
  })
})

describe("solveExchanges — vegetable_a capped at 2 exchanges for non_vegetarian only", () => {
  // non_vegetarian's meat_lean always anchors dinner (meal-distributor.ts),
  // structurally excluding vegetable_a from ever landing there — so the
  // day's whole vegetable_a allocation always lands at the one remaining
  // meal (lunch). A dietitian confirmed capping it at 2 exchanges (200 g,
  // one realistic dish) for this population specifically is fine, with
  // cereal absorbing the resulting carb difference. Every other diet type
  // keeps the full 4-exchange floor since they split vegetable_a naturally
  // across both lunch and dinner.
  function countsOf(result: ReturnType<typeof solveExchanges>) {
    return result.ok ? result.exchangeCounts : result.best.exchangeCounts
  }

  it("non_vegetarian never exceeds 2 vegetable_a exchanges, even on a target that would otherwise widen the search", () => {
    // Rahul (TEST-002)'s real target — comfortably solvable, but exercising
    // the same target used elsewhere to confirm the cap holds under real
    // numbers, not just a synthetic one.
    const result = solveExchanges({ kcal: 2339, proteinG: 108, fatG: 58, carbsG: 346, fibreG: 31, dietType: "non_vegetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.exchangeCounts.vegetable_a).toBe(2)
  })

  it("other diet types keep the full 4-exchange floor (widened up to 8) — the cap is non_vegetarian-specific", () => {
    const base = { kcal: 1900, proteinG: 65, fatG: 55, carbsG: 286, fibreG: 30 }
    for (const dietType of ["vegetarian", "eggetarian", "jain"] as const) {
      const counts = countsOf(solveExchanges({ ...base, dietType }))
      expect(counts.vegetable_a, dietType).toBeGreaterThanOrEqual(4)
    }
  })

  it("compensates the reduced vegetable_a with more cereal rather than drifting off the carbs target", () => {
    const result = solveExchanges({ kcal: 2339, proteinG: 108, fatG: 58, carbsG: 346, fibreG: 31, dietType: "non_vegetarian" })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.deviation.carbsG).toBeLessThan(0.015)
  })
})
