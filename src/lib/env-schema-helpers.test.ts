import { describe, expect, it } from "vitest"

import { optionalBoundedInt } from "./env-schema-helpers"

const schema = optionalBoundedInt(3, 0, 10)

describe("optionalBoundedInt", () => {
  it("uses the default when the variable is not set at all", () => {
    expect(schema.parse(undefined)).toBe(3)
  })

  it("treats a BLANK value as not set, not as zero", () => {
    // The whole reason this helper exists: z.coerce.number().default(3)
    // returns 0 here, and 0 is a meaningful value (it restores the old
    // 19-22 call retry path), so the mistake is silent and expensive.
    expect(schema.parse("")).toBe(3)
    expect(schema.parse("   ")).toBe(3)
  })

  it("reads a real value", () => {
    expect(schema.parse("5")).toBe(5)
    expect(schema.parse(" 5 ")).toBe(5)
  })

  it("still honours an explicit zero", () => {
    expect(schema.parse("0")).toBe(0)
  })

  it("rejects a non-numeric value loudly — a typo should fail the boot", () => {
    expect(() => schema.parse("three")).toThrow()
  })

  it("rejects values outside the bounds", () => {
    expect(() => schema.parse("11")).toThrow()
    expect(() => schema.parse("-1")).toThrow()
  })

  it("rejects a non-integer", () => {
    expect(() => schema.parse("2.5")).toThrow()
  })
})
