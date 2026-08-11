import { describe, expect, it } from "vitest"

import { isMixedVegDay } from "./mixed-veg-day"

describe("isMixedVegDay", () => {
  it("selects exactly one day out of every 7-day block (week 1: rotationDay 0-6)", () => {
    const flags = Array.from({ length: 7 }, (_, i) => isMixedVegDay(i))
    expect(flags.filter(Boolean)).toHaveLength(1)
  })

  it("selects exactly one day out of every subsequent 7-day block (week 2: rotationDay 7-13)", () => {
    const flags = Array.from({ length: 7 }, (_, i) => isMixedVegDay(7 + i))
    expect(flags.filter(Boolean)).toHaveLength(1)
  })

  it("selects exactly one day across many consecutive week blocks — never 0, never 2+", () => {
    for (let week = 0; week < 20; week++) {
      const flags = Array.from({ length: 7 }, (_, i) => isMixedVegDay(week * 7 + i))
      expect(flags.filter(Boolean), `week block ${week}`).toHaveLength(1)
    }
  })

  it("is pure and deterministic — same rotationDay always gives the same answer", () => {
    expect(isMixedVegDay(17)).toBe(isMixedVegDay(17))
  })

  it("the designated day is not pinned to the same weekday every week", () => {
    const weekdayOf = (week: number) => Array.from({ length: 7 }, (_, i) => isMixedVegDay(week * 7 + i)).indexOf(true)
    const weekdays = Array.from({ length: 10 }, (_, week) => weekdayOf(week))
    // Not every week landing on the identical weekday would defeat "which day varies" — assert some variation exists.
    expect(new Set(weekdays).size).toBeGreaterThan(1)
  })
})
