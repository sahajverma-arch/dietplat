import { describe, expect, it } from "vitest"

import { NoEligibleFoodsError, eligibleFoodsForSkeleton, filterEligibleFoods } from "./eligible-foods"
import { makeFood } from "./test-fixtures"

describe("filterEligibleFoods", () => {
  const roti = makeFood({ nameEn: "Roti", exchangeType: "cereal", regions: ["north_indian"], dietTypes: ["vegetarian"] })
  const poli = makeFood({ nameEn: "Poli", exchangeType: "cereal", regions: ["maharashtrian"], dietTypes: ["vegetarian"] })
  const egg = makeFood({ nameEn: "Egg", exchangeType: "meat", regions: ["generic"], dietTypes: ["eggetarian", "non_vegetarian"], allergens: ["egg"] })
  const inactiveDal = makeFood({ nameEn: "Old Dal", exchangeType: "pulse", isActive: false })
  const all = [roti, poli, egg, inactiveDal]

  it("drops inactive foods", () => {
    const result = filterEligibleFoods(all, {
      region: "north_indian",
      dietType: "vegetarian",
      clientAllergens: [],
      clientDislikes: [],
    })
    expect(result.map((f) => f.id)).not.toContain(inactiveDal.id)
  })

  it("keeps only the requested region plus generic", () => {
    const result = filterEligibleFoods(all, {
      region: "north_indian",
      dietType: "vegetarian",
      clientAllergens: [],
      clientDislikes: [],
    })
    expect(result.map((f) => f.nameEn)).toContain("Roti")
    expect(result.map((f) => f.nameEn)).not.toContain("Poli")
  })

  it("filters by diet type", () => {
    const result = filterEligibleFoods(all, {
      region: "generic",
      dietType: "vegetarian",
      clientAllergens: [],
      clientDislikes: [],
    })
    expect(result.map((f) => f.nameEn)).not.toContain("Egg")
  })

  it("excludes foods carrying a client allergen", () => {
    const result = filterEligibleFoods(all, {
      region: "generic",
      dietType: "eggetarian",
      clientAllergens: ["egg"],
      clientDislikes: [],
    })
    expect(result.map((f) => f.nameEn)).not.toContain("Egg")
  })

  it("excludes foods matching a client dislike by name, case-insensitively", () => {
    const result = filterEligibleFoods(all, {
      region: "north_indian",
      dietType: "vegetarian",
      clientAllergens: [],
      clientDislikes: ["ROTI"],
    })
    expect(result.map((f) => f.nameEn)).not.toContain("Roti")
  })

  it("excludes medical-tag foods for the given condition", () => {
    const rawSoyFood = makeFood({ nameEn: "Raw Soy Chunks", exchangeType: "pulse", tags: ["raw_soy"] })
    const result = filterEligibleFoods([rawSoyFood], {
      region: "north_indian",
      dietType: "vegetarian",
      clientAllergens: [],
      clientDislikes: [],
      medicalTags: ["hypothyroid"],
    })
    expect(result).toHaveLength(0)
  })
})

describe("eligibleFoodsForSkeleton", () => {
  it("groups eligible foods by slot and exchange type", () => {
    const roti = makeFood({ nameEn: "Roti", exchangeType: "cereal", mealSlots: ["breakfast", "lunch", "dinner"] })
    const needed = new Map([["cereal" as const, new Set(["breakfast", "lunch"])]])

    const result = eligibleFoodsForSkeleton(
      [roti],
      { region: "north_indian", dietType: "vegetarian", clientAllergens: [], clientDislikes: [] },
      needed
    )

    expect(result.breakfast?.cereal?.map((f) => f.id)).toEqual([roti.id])
    expect(result.lunch?.cereal?.map((f) => f.id)).toEqual([roti.id])
  })

  it("throws NoEligibleFoodsError naming the filter that emptied the set", () => {
    const roti = makeFood({ nameEn: "Roti", exchangeType: "cereal", mealSlots: ["breakfast"] })
    const needed = new Map([["cereal" as const, new Set(["dinner"])]])

    expect(() =>
      eligibleFoodsForSkeleton(
        [roti],
        { region: "north_indian", dietType: "vegetarian", clientAllergens: [], clientDislikes: [] },
        needed
      )
    ).toThrow(NoEligibleFoodsError)

    try {
      eligibleFoodsForSkeleton(
        [roti],
        { region: "north_indian", dietType: "vegetarian", clientAllergens: [], clientDislikes: [] },
        needed
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(NoEligibleFoodsError)
      expect((err as NoEligibleFoodsError).failedFilter).toBe("meal_slots")
    }
  })

  it("names the region filter when no food of that exchange type serves the region", () => {
    const roti = makeFood({ nameEn: "Roti", exchangeType: "cereal", regions: ["maharashtrian"] })
    const needed = new Map([["cereal" as const, new Set(["breakfast"])]])

    try {
      eligibleFoodsForSkeleton(
        [roti],
        { region: "north_indian", dietType: "vegetarian", clientAllergens: [], clientDislikes: [] },
        needed
      )
      expect.unreachable()
    } catch (err) {
      expect((err as NoEligibleFoodsError).failedFilter).toBe("regions")
    }
  })
})
