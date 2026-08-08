import { describe, expect, it } from "vitest"
import { proteinRamp } from "./protein-ramp"

function afterValues(rows: ReturnType<typeof proteinRamp>) {
  return rows.map((r) => r.afterG)
}

describe("proteinRamp", () => {
  it("Priya (TEST-001): 50 → 79 g over 5 weeks", () => {
    const rows = proteinRamp(50, 79)
    expect(afterValues(rows)).toEqual([55, 60, 65, 70, 79])
    expect(rows.map((r) => r.stepG)).toEqual([5, 5, 5, 5, 9])
    expect(rows.at(-1)?.stepFormula).toBe("gap ≤ 10 g → close-out: full 9 g")
  })

  it("Sneha (TEST-003): 63 → 107 g over 6 weeks", () => {
    const rows = proteinRamp(63, 107)
    expect(afterValues(rows)).toEqual([73, 83, 88, 93, 98, 107])
    expect(rows.map((r) => r.stepG)).toEqual([10, 10, 5, 5, 5, 9])
  })

  it("Rahul (TEST-002): 98 → 131 g over 5 weeks", () => {
    const rows = proteinRamp(98, 131)
    expect(afterValues(rows)).toEqual([108, 113, 118, 123, 131])
    expect(rows.map((r) => r.stepG)).toEqual([10, 5, 5, 5, 8])
  })

  it("Aadi (TEST-004): 83 → 99 g over 3 weeks", () => {
    const rows = proteinRamp(83, 99)
    expect(afterValues(rows)).toEqual([88, 93, 99])
    expect(rows.map((r) => r.stepG)).toEqual([5, 5, 6])
  })

  it("returns no rows when already at or above target", () => {
    expect(proteinRamp(90, 90)).toEqual([])
    expect(proteinRamp(95, 90)).toEqual([])
  })
})
