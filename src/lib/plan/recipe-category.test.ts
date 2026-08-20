import { describe, expect, it } from "vitest"

import { recipeCategoryBucket } from "./recipe-category"

describe("recipeCategoryBucket", () => {
  it("buckets real category strings correctly", () => {
    expect(recipeCategoryBucket("Heavy Meal")).toBe("heavy_meal")
    expect(recipeCategoryBucket("Light Meal")).toBe("light_meal")
    expect(recipeCategoryBucket("Sabzi")).toBe("sabzi")
    expect(recipeCategoryBucket("Dal Curry")).toBe("dal_curry")
    expect(recipeCategoryBucket("Khichdi")).toBe("dal_curry")
    expect(recipeCategoryBucket("Pulao")).toBe("rice_pulao")
    expect(recipeCategoryBucket("Biryani")).toBe("rice_pulao")
    expect(recipeCategoryBucket("Paratha")).toBe("bread")
    expect(recipeCategoryBucket("Sandwich")).toBe("bread")
    expect(recipeCategoryBucket("Chaat")).toBe("snack")
    expect(recipeCategoryBucket("Dessert")).toBe("dessert")
    expect(recipeCategoryBucket("Salad")).toBe("salad")
    expect(recipeCategoryBucket("Raita")).toBe("salad")
    expect(recipeCategoryBucket("Soup")).toBe("soup")
    expect(recipeCategoryBucket("Smoothie")).toBe("beverage")
    expect(recipeCategoryBucket("Fruit")).toBe("fruit")
  })

  it("is case-insensitive", () => {
    expect(recipeCategoryBucket("HEAVY MEAL")).toBe("heavy_meal")
  })

  it("falls back to other for an unrecognized category", () => {
    expect(recipeCategoryBucket("Something Entirely Novel")).toBe("other")
  })
})
