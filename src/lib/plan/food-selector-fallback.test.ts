import { describe, expect, it } from "vitest"

import { fallbackSelection } from "./food-selector-fallback"
import { makeFood } from "./test-fixtures"
import type { FoodSelectorInput } from "./food-selector-types"

const roti = makeFood({ id: "roti", nameEn: "Roti", exchangeType: "cereal" })
const rice = makeFood({ id: "rice", nameEn: "Rice", exchangeType: "cereal" })
const palak = makeFood({ id: "palak", nameEn: "Palak", exchangeType: "vegetable_a" })
const bhindi = makeFood({ id: "bhindi", nameEn: "Bhindi", exchangeType: "vegetable_a" })
const moongDal = makeFood({ id: "moong_dal", nameEn: "Moong Dal", exchangeType: "pulse" })

const input: FoodSelectorInput = {
  region: "north_indian",
  dietType: "vegetarian",
  mealCount: 5,
  skeleton: {
    breakfast: [{ exchangeType: "cereal", count: 2 }],
    dinner: [
      { exchangeType: "vegetable_a", count: 2 },
      { exchangeType: "pulse", count: 1 },
    ],
  },
  eligibleFoodsBySlot: {
    breakfast: { cereal: [roti, rice] },
    dinner: { vegetable_a: [palak, bhindi], pulse: [moongDal] },
  },
}

describe("fallbackSelection", () => {
  const selection = fallbackSelection(input)

  it("produces exactly 7 days, 0-indexed", () => {
    expect(selection.days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("every day's exchange totals match the skeleton exactly", () => {
    for (const day of selection.days) {
      for (const [slot, items] of Object.entries(input.skeleton)) {
        const meal = day.meals.find((m) => m.slot === slot)
        expect(meal, `day ${day.dayIndex} missing slot ${slot}`).toBeDefined()
        for (const skeletonItem of items) {
          const total = meal!.items
            .filter((i) => i.exchangeType === skeletonItem.exchangeType)
            .reduce((sum, i) => sum + i.exchangeCount, 0)
          expect(total, `day ${day.dayIndex} ${slot} ${skeletonItem.exchangeType}`).toBe(skeletonItem.count)
        }
      }
    }
  })

  it("splits a splittable type (vegetable_a) with count >= 2 across 2 distinct foods", () => {
    for (const day of selection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems).toHaveLength(2)
      expect(new Set(vegAItems.map((i) => i.foodId)).size).toBe(2)
      expect(vegAItems.every((i) => i.exchangeCount === 1)).toBe(true)
    }
  })

  it("does not split a non-splittable type (cereal) even at count >= 2", () => {
    for (const day of selection.days) {
      const breakfast = day.meals.find((m) => m.slot === "breakfast")!
      const cerealItems = breakfast.items.filter((i) => i.exchangeType === "cereal")
      expect(cerealItems).toHaveLength(1)
      expect(cerealItems[0].exchangeCount).toBe(2)
    }
  })

  it("rotates the cereal food across days rather than repeating the same one every day", () => {
    const foodIdsByDay = selection.days.map(
      (d) => d.meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "cereal")!.foodId
    )
    expect(new Set(foodIdsByDay).size).toBeGreaterThan(1)
  })

  it("is deterministic — same input produces identical output", () => {
    const again = fallbackSelection(input)
    expect(again).toEqual(selection)
  })

  it("throws when a skeleton exchange type has no eligible foods at all", () => {
    const broken: FoodSelectorInput = {
      ...input,
      eligibleFoodsBySlot: { breakfast: { cereal: [roti, rice] }, dinner: { vegetable_a: [palak, bhindi], pulse: [] } },
    }
    expect(() => fallbackSelection(broken)).toThrow()
  })
})

describe("fallbackSelection — works correctly with an archetype-narrowed pool (Meal Archetype layer)", () => {
  // fallback-selector.ts itself is completely unmodified for the archetype
  // layer — the only thing that changes is the pool eligible-foods.ts hands
  // it (see eligible-foods.test.ts's "dish-family narrowing" tests). This
  // proves the existing, unredesigned algorithm still produces a fully
  // valid plan once that pool has already been narrowed to a single dish
  // family, i.e. fallback mode gets full archetype coherence for free.
  const idli = makeFood({ id: "idli", nameEn: "Idli", exchangeType: "cereal" })
  // Note: dosa/masoor-style alternatives are deliberately absent from this
  // narrowed input — archetype narrowing to "only sambar-family foods" is
  // exactly what would leave a single-item pool in a real generation.
  const sambar = makeFood({ id: "sambar", nameEn: "Sambar", exchangeType: "pulse" })

  const narrowedInput: FoodSelectorInput = {
    region: "south_indian",
    dietType: "vegetarian",
    mealCount: 5,
    skeleton: {
      breakfast: [
        { exchangeType: "cereal", count: 2 },
        { exchangeType: "pulse", count: 0.5 },
      ],
    },
    eligibleFoodsBySlot: {
      breakfast: { cereal: [idli], pulse: [sambar] },
    },
  }

  it("still produces a fully valid 7-day plan when the pool has been narrowed to a single archetype-consistent food per exchange type", () => {
    const result = fallbackSelection(narrowedInput)
    expect(result.days).toHaveLength(7)
    for (const day of result.days) {
      const breakfast = day.meals.find((m) => m.slot === "breakfast")!
      expect(breakfast.items.every((i) => i.foodId === "idli" || i.foodId === "sambar")).toBe(true)
      const cerealTotal = breakfast.items.filter((i) => i.exchangeType === "cereal").reduce((s, i) => s + i.exchangeCount, 0)
      const pulseTotal = breakfast.items.filter((i) => i.exchangeType === "pulse").reduce((s, i) => s + i.exchangeCount, 0)
      expect(cerealTotal).toBe(2)
      expect(pulseTotal).toBe(0.5)
    }
  })

  it("remains deterministic and requires no LLM/network dependency with a narrowed pool", () => {
    const first = fallbackSelection(narrowedInput)
    const second = fallbackSelection(narrowedInput)
    expect(first).toEqual(second)
  })
})

describe("fallbackSelection — same-day protein exclusion", () => {
  const rice = makeFood({ id: "rice", nameEn: "Rice", exchangeType: "cereal" })
  const roti = makeFood({ id: "roti", nameEn: "Roti", exchangeType: "cereal" })
  const rajma = makeFood({ id: "rajma", nameEn: "Rajma", exchangeType: "pulse" })
  const chana = makeFood({ id: "chana", nameEn: "Chana", exchangeType: "pulse" })
  const moong = makeFood({ id: "moong", nameEn: "Moong Dal", exchangeType: "pulse" })

  const lunchDinnerInput: FoodSelectorInput = {
    region: "north_indian",
    dietType: "vegetarian",
    mealCount: 5,
    skeleton: {
      lunch: [
        { exchangeType: "cereal", count: 2 },
        { exchangeType: "pulse", count: 1 },
      ],
      dinner: [
        { exchangeType: "cereal", count: 2 },
        { exchangeType: "pulse", count: 1 },
      ],
    },
    eligibleFoodsBySlot: {
      lunch: { cereal: [rice, roti], pulse: [rajma, chana, moong] },
      dinner: { cereal: [rice, roti], pulse: [rajma, chana, moong] },
    },
  }

  it("never picks the same pulse for lunch and dinner on the same day when alternatives exist", () => {
    const result = fallbackSelection(lunchDinnerInput)
    for (const day of result.days) {
      const lunchPulse = day.meals.find((m) => m.slot === "lunch")!.items.find((i) => i.exchangeType === "pulse")!
      const dinnerPulse = day.meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "pulse")!
      expect(lunchPulse.foodId, `day ${day.dayIndex}`).not.toBe(dinnerPulse.foodId)
    }
  })

  it("leaves non-protein exchange types (cereal) untouched — can still repeat across lunch and dinner", () => {
    const result = fallbackSelection(lunchDinnerInput)
    // Not asserting they DO match every day (that's rotation's business), only that cereal
    // selection is unaffected by the pulse exclusion logic — i.e. it still ever repeats,
    // proving no exclusion was silently applied to a non-protein type.
    const anyDayCerealMatches = result.days.some((day) => {
      const lunchCereal = day.meals.find((m) => m.slot === "lunch")!.items.find((i) => i.exchangeType === "cereal")!
      const dinnerCereal = day.meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "cereal")!
      return lunchCereal.foodId === dinnerCereal.foodId
    })
    expect(anyDayCerealMatches).toBe(true)
  })

  it("degrades gracefully to a repeat when no alternative pulse exists", () => {
    const onlyOnePulse: FoodSelectorInput = {
      ...lunchDinnerInput,
      eligibleFoodsBySlot: {
        lunch: { cereal: [rice, roti], pulse: [rajma] },
        dinner: { cereal: [rice, roti], pulse: [rajma] },
      },
    }
    expect(() => fallbackSelection(onlyOnePulse)).not.toThrow()
    const result = fallbackSelection(onlyOnePulse)
    for (const day of result.days) {
      const lunchPulse = day.meals.find((m) => m.slot === "lunch")!.items.find((i) => i.exchangeType === "pulse")!
      const dinnerPulse = day.meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "pulse")!
      expect(lunchPulse.foodId).toBe("rajma")
      expect(dinnerPulse.foodId).toBe("rajma")
    }
  })

  it("excludes by dish family, not just by food id — two different foods sharing a dish_family_id still count as a repeat", () => {
    const sambarA = makeFood({ id: "sambar-a", nameEn: "Sambar (batch A)", exchangeType: "pulse", dishFamilyId: "sambar-family" })
    const sambarB = makeFood({ id: "sambar-b", nameEn: "Sambar (batch B)", exchangeType: "pulse", dishFamilyId: "sambar-family" })
    const rasam = makeFood({ id: "rasam", nameEn: "Rasam", exchangeType: "pulse", dishFamilyId: "rasam-family" })

    const familyInput: FoodSelectorInput = {
      ...lunchDinnerInput,
      eligibleFoodsBySlot: {
        lunch: { cereal: [rice, roti], pulse: [sambarA, sambarB] },
        dinner: { cereal: [rice, roti], pulse: [sambarA, sambarB, rasam] },
      },
    }
    const result = fallbackSelection(familyInput)
    for (const day of result.days) {
      const dinnerPulse = day.meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "pulse")!
      // Whichever sambar variant lunch picked, dinner must never land on the OTHER sambar
      // variant either — both share dishFamilyId "sambar-family", so both are excluded.
      expect(dinnerPulse.foodId).toBe("rasam")
    }
  })

  it("is deterministic with same-day exclusion active", () => {
    const first = fallbackSelection(lunchDinnerInput)
    const second = fallbackSelection(lunchDinnerInput)
    expect(first).toEqual(second)
  })
})
