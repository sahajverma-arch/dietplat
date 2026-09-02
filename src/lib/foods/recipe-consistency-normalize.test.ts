import { describe, expect, it } from "vitest"

import { normalizeRecipeConsistency } from "./recipe-consistency-normalize"

describe("normalizeRecipeConsistency", () => {
  it("normalizes 'Liquid' to liquid", () => {
    expect(normalizeRecipeConsistency("Liquid")).toBe("liquid")
  })

  it("normalizes 'Solid' to solid", () => {
    expect(normalizeRecipeConsistency("Solid")).toBe("solid")
  })

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeRecipeConsistency("  LIQUID  ")).toBe("liquid")
  })

  it("returns null for a blank value", () => {
    expect(normalizeRecipeConsistency("")).toBeNull()
  })

  it("returns null for an unrecognized value rather than throwing", () => {
    expect(normalizeRecipeConsistency("Semi-Solid")).toBeNull()
  })
})
