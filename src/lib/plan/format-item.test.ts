import { describe, expect, it } from "vitest"
import { formatItemLabel, formatItemQuantity } from "./format-item"
import type { PlanViewItem } from "./plan-view-model"

function item(overrides: Partial<PlanViewItem>): PlanViewItem {
  return {
    id: "item-1",
    foodId: "food-1",
    nameEn: "Egg",
    householdMeasure: null,
    servingRawG: 80,
    exchangeType: "meat",
    exchangeCount: 2,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    dishFamilyId: null,
    tags: [],
    ...overrides,
  }
}

describe("formatItemQuantity", () => {
  it("shows the exchange count alongside grams for meat (egg)", () => {
    expect(formatItemQuantity(item({ exchangeType: "meat", exchangeCount: 2, servingRawG: 80 }))).toBe("2, 80 g")
  })

  it("shows the exchange count alongside grams for meat_lean (chicken/fish)", () => {
    expect(formatItemQuantity(item({ exchangeType: "meat_lean", exchangeCount: 2, servingRawG: 70 }))).toBe("2, 70 g")
  })

  it("still reads naturally for a single egg", () => {
    expect(formatItemQuantity(item({ exchangeType: "meat", exchangeCount: 1, servingRawG: 40 }))).toBe("1, 40 g")
  })

  it("falls back to grams only for divisible exchange types (cereal, vegetable_a, ...)", () => {
    expect(formatItemQuantity(item({ exchangeType: "cereal", exchangeCount: 2.5, servingRawG: 100 }))).toBe("100 g")
  })

  it("falls back to grams only when exchangeCount isn't a whole number, even for meat", () => {
    expect(formatItemQuantity(item({ exchangeType: "meat", exchangeCount: 1.5, servingRawG: 60 }))).toBe("60 g")
  })

  it("uses ml when the food's household measure says so", () => {
    expect(
      formatItemQuantity(item({ exchangeType: "milk_cow", exchangeCount: 1, servingRawG: 250, householdMeasure: "1 glass (ml)" }))
    ).toBe("250 ml")
  })

  it("falls back to household measure or a generic portion when no serving grams are recorded", () => {
    expect(formatItemQuantity(item({ servingRawG: null, householdMeasure: "1 medium" }))).toBe("1 medium")
    expect(formatItemQuantity(item({ servingRawG: null, householdMeasure: null }))).toBe("1 portion")
  })
})

describe("formatItemLabel", () => {
  it("combines the food name with its formatted quantity", () => {
    expect(formatItemLabel(item({ nameEn: "Egg", exchangeType: "meat", exchangeCount: 2, servingRawG: 80 }))).toBe("Egg (2, 80 g)")
  })
})
