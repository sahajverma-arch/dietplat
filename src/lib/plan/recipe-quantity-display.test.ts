import { describe, expect, it } from "vitest"

import { formatRecipeQuantity } from "./recipe-quantity-display"

describe("formatRecipeQuantity", () => {
  it("shows a bare count for Fruit, no unit word", () => {
    expect(formatRecipeQuantity({ name: "Apple", category: "Fruit", unitLabel: "piece", perUnitGrams: 150 }, 245)).toBe("2")
  })

  it("rounds to the nearest whole piece and pluralizes", () => {
    expect(formatRecipeQuantity({ name: "Roti", category: "Bread", unitLabel: "piece", perUnitGrams: 40 }, 105)).toBe("3 pieces")
  })

  it("keeps singular for a count of 1", () => {
    expect(formatRecipeQuantity({ name: "Roti", category: "Bread", unitLabel: "piece", perUnitGrams: 40 }, 45)).toBe("1 piece")
  })

  it("pluralizes a vessel-noun unit normally (cup -> cups)", () => {
    expect(formatRecipeQuantity({ name: "Masala Chai", category: "Tea", unitLabel: "cup", perUnitGrams: 150 }, 320)).toBe("2 cups")
  })

  it("uses the irregular plural for glass (glass -> glasses)", () => {
    expect(formatRecipeQuantity({ name: "Orange Juice", category: "Juice", unitLabel: "glass", perUnitGrams: 200 }, 450)).toBe("2 glasses")
  })

  it("never pluralizes an abbreviation like tbsp", () => {
    expect(formatRecipeQuantity({ name: "Guacamole", category: "Dip", unitLabel: "tbsp", perUnitGrams: 15 }, 45)).toBe("3 tbsp")
  })

  it("never rounds down to zero, even for a tiny gram amount", () => {
    expect(formatRecipeQuantity({ name: "Cashew", category: "Nuts", unitLabel: "piece", perUnitGrams: 40 }, 5)).toBe("1 piece")
  })

  it("returns null when the recipe has no derivable unit, so the caller can fall back to grams", () => {
    expect(formatRecipeQuantity({ name: "Grilled Chicken", category: "Heavy Meal", unitLabel: null, perUnitGrams: null }, 150)).toBeNull()
  })

  it("defaults to 'piece' when unitLabel is missing but perUnitGrams is present", () => {
    expect(formatRecipeQuantity({ name: "Some Snack", category: "Snack", unitLabel: null, perUnitGrams: 30 }, 90)).toBe("3 pieces")
  })

  it("does not double-pluralize a noun that was already plural as scraped, when it doesn't happen to match the recipe's own name", () => {
    // "Trail Mix" quantified as "10 almonds" -> unitLabel "almonds" (already
    // plural) — doesn't share a word with the recipe name, so the bare-count
    // rule doesn't apply here; this isolates the pluralizer's own behavior.
    expect(formatRecipeQuantity({ name: "Trail Mix", category: "Nuts", unitLabel: "almonds", perUnitGrams: 0.8 }, 50)).toBe("63 almonds")
  })

  it("when the already-plural noun DOES match the recipe's own name, the bare-count rule takes over instead (also correct, just a different path)", () => {
    expect(formatRecipeQuantity({ name: "Peanuts", category: "Nuts", unitLabel: "peanuts", perUnitGrams: 0.8 }, 50)).toBe("63")
  })

  it("falls back to a bare count when the derived unit word repeats the recipe's own name (Rice -> 1, not 1 rice)", () => {
    expect(formatRecipeQuantity({ name: "Rice", category: "Rice", unitLabel: "rice", perUnitGrams: 200 }, 230)).toBe("1")
  })

  it("bare-count fallback is case-insensitive and matches on a whole word", () => {
    expect(formatRecipeQuantity({ name: "Jeera Rice", category: "Rice", unitLabel: "Rice", perUnitGrams: 200 }, 230)).toBe("1")
  })
})
