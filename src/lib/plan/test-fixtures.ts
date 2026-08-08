/** Shared minimal Food fixtures for plan/*.test.ts — not a production module. */

import type { Food } from "@/db/schema"
import type { ExchangeCode } from "./table-4-1"

let counter = 0

export function makeFood(overrides: Partial<Food> & { exchangeType: ExchangeCode }): Food {
  counter += 1
  return {
    id: overrides.id ?? `food-${counter}`,
    nameEn: overrides.nameEn ?? `Food ${counter}`,
    nameHi: null,
    exchangeUnits: 1,
    servingRawG: 20,
    householdMeasure: "1 portion",
    regions: ["north_indian"],
    dietTypes: ["vegetarian", "eggetarian", "non_vegetarian"],
    mealSlots: ["breakfast", "mid_morning", "lunch", "evening", "dinner"],
    allergens: [],
    tags: [],
    isActive: true,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}
