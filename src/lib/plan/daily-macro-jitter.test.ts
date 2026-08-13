import { describe, expect, it } from "vitest"

import { computeDailyPulseJitter } from "./daily-macro-jitter"
import { VEGAN_PULSE_FLOOR } from "./exchange-solver"

describe("computeDailyPulseJitter", () => {
  it("returns 7 deltas that always sum to exactly 0", () => {
    const deltas = computeDailyPulseJitter(5, "non_vegetarian", "roadmap-1:week-1")
    expect(deltas).toHaveLength(7)
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it("sums to 0 across a range of base pulse counts and diet types", () => {
    const dietTypes = ["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"] as const
    for (const dietType of dietTypes) {
      for (const base of [0.5, 1, 2, 3, 5, 8]) {
        const deltas = computeDailyPulseJitter(base, dietType, `${dietType}:${base}`)
        expect(deltas.reduce((a, b) => a + b, 0), `${dietType} base=${base}`).toBe(0)
      }
    }
  })

  it("every non-zero delta is exactly ±0.5", () => {
    const deltas = computeDailyPulseJitter(5, "vegetarian", "seed-a")
    for (const d of deltas) {
      expect([-0.5, 0, 0.5]).toContain(d)
    }
  })

  it("uses exactly 3 up, 3 down, 1 flat", () => {
    const deltas = computeDailyPulseJitter(5, "vegetarian", "seed-b")
    expect(deltas.filter((d) => d === 0.5)).toHaveLength(3)
    expect(deltas.filter((d) => d === -0.5)).toHaveLength(3)
    expect(deltas.filter((d) => d === 0)).toHaveLength(1)
  })

  it("degrades to all-zero when subtracting 0.5 would go negative (non-vegan floor of 0)", () => {
    expect(computeDailyPulseJitter(0, "vegetarian", "seed-c")).toEqual(new Array(7).fill(0))
    expect(computeDailyPulseJitter(0.25, "non_vegetarian", "seed-d")).toEqual(new Array(7).fill(0))
  })

  it("degrades to all-zero for vegan when subtracting 0.5 would breach VEGAN_PULSE_FLOOR", () => {
    expect(computeDailyPulseJitter(VEGAN_PULSE_FLOOR, "vegan", "seed-e")).toEqual(new Array(7).fill(0))
    expect(computeDailyPulseJitter(VEGAN_PULSE_FLOOR + 0.25, "vegan", "seed-f")).toEqual(new Array(7).fill(0))
  })

  it("does not degrade for vegan once comfortably above the floor", () => {
    const deltas = computeDailyPulseJitter(VEGAN_PULSE_FLOOR + 1, "vegan", "seed-g")
    expect(deltas.some((d) => d !== 0)).toBe(true)
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it("is pure and deterministic — same seed always gives the same pattern", () => {
    const a = computeDailyPulseJitter(5, "vegetarian", "same-seed")
    const b = computeDailyPulseJitter(5, "vegetarian", "same-seed")
    expect(a).toEqual(b)
  })

  it("different seeds are not pinned to the same day-assignment every time", () => {
    const patterns = Array.from({ length: 10 }, (_, i) => computeDailyPulseJitter(5, "vegetarian", `seed-${i}`).join(","))
    expect(new Set(patterns).size).toBeGreaterThan(1)
  })
})
