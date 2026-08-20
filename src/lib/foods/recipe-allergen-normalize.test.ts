import { describe, expect, it } from "vitest"

import { normalizeRecipeAllergenTags } from "./recipe-allergen-normalize"

describe("normalizeRecipeAllergenTags", () => {
  it("normalizes a simple single-token value", () => {
    expect(normalizeRecipeAllergenTags("Lactose").tags).toEqual(["lactose"])
  })

  it("splits and normalizes a multi-token value", () => {
    expect(normalizeRecipeAllergenTags("Onion/Garlic, Citrus").tags.sort()).toEqual(["citrus", "onion_garlic"])
  })

  it("merges wheat into gluten (confirmed: casing/data-entry artifact, not two concepts)", () => {
    const { tags } = normalizeRecipeAllergenTags("Gluten, Lactose, Gluten, wheat")
    expect(tags.sort()).toEqual(["gluten", "lactose"])
  })

  it("keeps Nut and Peanuts as distinct tags", () => {
    const { tags } = normalizeRecipeAllergenTags("Peanuts, Nut")
    expect(tags.sort()).toEqual(["nut", "peanuts"])
  })

  it("normalizes real typo/casing variants", () => {
    expect(normalizeRecipeAllergenTags("Onion/Garli").tags).toEqual(["onion_garlic"])
    expect(normalizeRecipeAllergenTags("Onion/ garlic").tags).toEqual(["onion_garlic"])
    expect(normalizeRecipeAllergenTags("Lactos").tags).toEqual(["lactose"])
    expect(normalizeRecipeAllergenTags("CITRUS").tags).toEqual(["citrus"])
    expect(normalizeRecipeAllergenTags("cruciferous vegetable").tags).toEqual(["cruciferous"])
  })

  it("handles a leading stray comma producing an empty token", () => {
    expect(normalizeRecipeAllergenTags(",gluten, onion/ garlic, wheat").tags.sort()).toEqual(["gluten", "onion_garlic"])
  })

  it("returns empty tags for a blank value", () => {
    expect(normalizeRecipeAllergenTags("").tags).toEqual([])
  })

  it("flags a genuinely unrecognized token instead of silently dropping it", () => {
    const { unclassifiedTokens } = normalizeRecipeAllergenTags("Durian")
    expect(unclassifiedTokens).toEqual(["DURIAN"])
  })
})
