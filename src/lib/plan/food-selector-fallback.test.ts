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

  it("keeps vegetable_a a single food on 6 of 7 days, mixing on EXACTLY one designated day per week — real everyday sabzi is single-vegetable, an arbitrary 2-food mix is the rare exception", () => {
    const counts = selection.days.map((day) => {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      // Whole-day total must always equal the skeleton count, split or not.
      expect(vegAItems.reduce((sum, i) => sum + i.exchangeCount, 0)).toBe(2)
      return vegAItems.length
    })
    const mixedDays = counts.filter((n) => n === 2).length
    const singleDays = counts.filter((n) => n === 1).length
    // Exactly 1 in 7 — not a per-day coin flip that can collide (see isMixedVegDay's doc comment).
    expect(mixedDays).toBe(1)
    expect(singleDays).toBe(6)
  })

  it("splits vegetable_a into 2 distinct foods on EXACTLY one day of the week, using the whole day's exchange count", () => {
    const largeInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_a", count: 4 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_a: [palak, bhindi] } },
    }
    const largeSelection = fallbackSelection(largeInput)
    const perDay = largeSelection.days.map((day) => {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems.reduce((sum, i) => sum + i.exchangeCount, 0)).toBe(4)
      return vegAItems.length
    })
    expect(perDay.filter((n) => n === 2)).toHaveLength(1)
    expect(perDay.filter((n) => n === 1)).toHaveLength(6)
  })

  it("the mixed-veg day shifts to a different weekday in week 2 (dayIndexOffset = 7) rather than repeating week 1's day", () => {
    const weeklyInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_a", count: 4 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_a: [palak, bhindi] } },
    }
    const mixedDayIndex = (sel: ReturnType<typeof fallbackSelection>) =>
      sel.days.findIndex((day) => {
        const dinner = day.meals.find((m) => m.slot === "dinner")!
        return dinner.items.filter((i) => i.exchangeType === "vegetable_a").length === 2
      })

    const week1Index = mixedDayIndex(fallbackSelection(weeklyInput))
    const week2Index = mixedDayIndex(fallbackSelection({ ...weeklyInput, dayIndexOffset: 7 }))

    expect(week1Index).toBeGreaterThanOrEqual(0)
    expect(week2Index).toBeGreaterThanOrEqual(0)
    expect(week1Index).not.toBe(week2Index)
  })

  it("never mixes vegetable_a below count 2, even on the designated mixed-veg day", () => {
    const belowThresholdInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_a", count: 1.5 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_a: [palak, bhindi] } },
    }
    const belowSelection = fallbackSelection(belowThresholdInput)
    for (const day of belowSelection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems).toHaveLength(1)
      expect(vegAItems[0].exchangeCount).toBe(1.5)
    }
  })

  it("excludes solo_only-tagged foods (Karela, Lauki, Brinjal, Tori) from the mixed-veg combo pool even on the designated mixed-veg day", () => {
    const karela = makeFood({ id: "karela", nameEn: "Karela", exchangeType: "vegetable_a", tags: ["solo_only"] })
    const lauki = makeFood({ id: "lauki", nameEn: "Lauki", exchangeType: "vegetable_a", tags: ["solo_only"] })
    const soloOnlyInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_a", count: 4 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_a: [karela, lauki] } },
    }
    const soloOnlySelection = fallbackSelection(soloOnlyInput)
    // Both eligible foods are solo_only, so the combo pool is always empty —
    // mixing must never happen, even on the day that would otherwise be gated in.
    for (const day of soloOnlySelection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems).toHaveLength(1)
      expect(vegAItems[0].exchangeCount).toBe(4)
    }
  })

  it("preserves the exact fractional exchange count (2.5) across both split and single days", () => {
    const fractionalInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_a", count: 2.5 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_a: [palak, bhindi] } },
    }
    const fractionalSelection = fallbackSelection(fractionalInput)
    for (const day of fractionalSelection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegAItems = dinner.items.filter((i) => i.exchangeType === "vegetable_a")
      expect(vegAItems.reduce((sum, i) => sum + i.exchangeCount, 0)).toBe(2.5)
    }
  })

  it("vegetable_b never gets the large-portion split — its smaller 50 g/exchange size stays a normal single dish even at a concentrated count", () => {
    const carrot = makeFood({ id: "carrot", nameEn: "Carrot", exchangeType: "vegetable_b" })
    const potato = makeFood({ id: "potato", nameEn: "Potato", exchangeType: "vegetable_b" })
    const vegBInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "non_vegetarian",
      mealCount: 5,
      skeleton: { dinner: [{ exchangeType: "vegetable_b", count: 4 }] },
      eligibleFoodsBySlot: { dinner: { vegetable_b: [carrot, potato] } },
    }
    const vegBSelection = fallbackSelection(vegBInput)
    for (const day of vegBSelection.days) {
      const dinner = day.meals.find((m) => m.slot === "dinner")!
      const vegBItems = dinner.items.filter((i) => i.exchangeType === "vegetable_b")
      expect(vegBItems).toHaveLength(1)
      expect(vegBItems[0].exchangeCount).toBe(4)
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

  it("fruit still splits into 2 distinct foods at count >= 2 — unlike vegetable_a/b, this part of the original behaviour is unchanged", () => {
    const orange = makeFood({ id: "orange", nameEn: "Orange", exchangeType: "fruit" })
    const guava = makeFood({ id: "guava", nameEn: "Guava", exchangeType: "fruit" })
    const fruitInput: FoodSelectorInput = {
      region: "north_indian",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: { evening: [{ exchangeType: "fruit", count: 2 }] },
      eligibleFoodsBySlot: { evening: { fruit: [orange, guava] } },
    }
    const fruitSelection = fallbackSelection(fruitInput)
    for (const day of fruitSelection.days) {
      const evening = day.meals.find((m) => m.slot === "evening")!
      const fruitItems = evening.items.filter((i) => i.exchangeType === "fruit")
      expect(fruitItems).toHaveLength(2)
      expect(new Set(fruitItems.map((i) => i.foodId)).size).toBe(2)
    }
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

describe("fallbackSelection — vegetable_a + vegetable_b never render as two separate sabzi dishes", () => {
  const tinda = makeFood({ id: "tinda", nameEn: "Tinda", exchangeType: "vegetable_a", dishFamilyId: "tinda-family" })
  const sweetCorn = makeFood({ id: "sweet-corn", nameEn: "Sweet corn", exchangeType: "vegetable_b" })
  const carrot = makeFood({ id: "carrot", nameEn: "Carrot", exchangeType: "vegetable_b", tags: ["salad"] })
  const onion = makeFood({ id: "onion", nameEn: "Onion", exchangeType: "vegetable_b", tags: ["salad"] })

  it("restricts vegetable_b to salad-tagged foods when it co-occurs with vegetable_a and no curated pair is provided", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        lunch: [
          { exchangeType: "vegetable_a", count: 2 },
          { exchangeType: "vegetable_b", count: 2 },
        ],
      },
      eligibleFoodsBySlot: { lunch: { vegetable_a: [tinda], vegetable_b: [sweetCorn, carrot, onion] } },
    }
    const selection = fallbackSelection(input)
    for (const day of selection.days) {
      const lunch = day.meals.find((m) => m.slot === "lunch")!
      const vegB = lunch.items.find((i) => i.exchangeType === "vegetable_b")!
      expect(vegB.foodId, `day ${day.dayIndex}`).not.toBe("sweet-corn")
      expect(["carrot", "onion"]).toContain(vegB.foodId)
    }
  })

  it("allows a non-salad vegetable_b food when the pairing matches a curated dish (Aloo Gobi-style)", () => {
    const sweetCornCurated = makeFood({
      id: "sweet-corn-curated",
      nameEn: "Sweet corn",
      exchangeType: "vegetable_b",
      dishFamilyId: "sweet-corn-family",
    })
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        lunch: [
          { exchangeType: "vegetable_a", count: 2 },
          { exchangeType: "vegetable_b", count: 2 },
        ],
      },
      eligibleFoodsBySlot: { lunch: { vegetable_a: [tinda], vegetable_b: [sweetCornCurated] } },
      curatedVegetableFamilyPairs: new Set(["sweet-corn-family|tinda-family"]),
    }

    const selection = fallbackSelection(input)
    for (const day of selection.days) {
      const lunch = day.meals.find((m) => m.slot === "lunch")!
      const vegB = lunch.items.find((i) => i.exchangeType === "vegetable_b")!
      expect(vegB.foodId, `day ${day.dayIndex}`).toBe("sweet-corn-curated")
    }
  })

  it("degrades to the full pool when no salad-tagged or curated-matching food is eligible — never throws, never leaves the slot empty", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        lunch: [
          { exchangeType: "vegetable_a", count: 2 },
          { exchangeType: "vegetable_b", count: 2 },
        ],
      },
      eligibleFoodsBySlot: { lunch: { vegetable_a: [tinda], vegetable_b: [sweetCorn] } },
    }
    expect(() => fallbackSelection(input)).not.toThrow()
    const selection = fallbackSelection(input)
    for (const day of selection.days) {
      const lunch = day.meals.find((m) => m.slot === "lunch")!
      const vegB = lunch.items.find((i) => i.exchangeType === "vegetable_b")!
      expect(vegB.foodId).toBe("sweet-corn")
    }
  })

  it("leaves vegetable_b's normal full-pool rotation untouched when vegetable_a isn't in the same slot", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: { evening: [{ exchangeType: "vegetable_b", count: 2 }] },
      eligibleFoodsBySlot: { evening: { vegetable_b: [sweetCorn, carrot] } },
    }
    const selection = fallbackSelection(input)
    const foodIds = new Set(selection.days.map((d) => d.meals.find((m) => m.slot === "evening")!.items[0].foodId))
    expect(foodIds.size).toBeGreaterThan(1) // rotates through both, including the non-salad one
  })
})

describe("fallbackSelection — no cooking fat alongside a plain porridge cereal", () => {
  const oats = makeFood({ id: "oats", nameEn: "Oats", exchangeType: "cereal", tags: ["no_cooking_fat"] })
  const paratha = makeFood({ id: "paratha", nameEn: "Aloo Paratha", exchangeType: "cereal" })
  const ghee = makeFood({ id: "ghee", nameEn: "Ghee", exchangeType: "fat", tags: ["cooking_fat"] })
  const almonds = makeFood({ id: "almonds", nameEn: "Almonds", exchangeType: "fat" })

  it("never picks a cooking_fat-tagged food for the same slot's fat exchange when the cereal is no_cooking_fat-tagged", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        breakfast: [
          { exchangeType: "cereal", count: 1 },
          { exchangeType: "fat", count: 1 },
        ],
      },
      eligibleFoodsBySlot: { breakfast: { cereal: [oats], fat: [ghee, almonds] } },
    }
    const selection = fallbackSelection(input)
    for (const day of selection.days) {
      const breakfast = day.meals.find((m) => m.slot === "breakfast")!
      const fatItem = breakfast.items.find((i) => i.exchangeType === "fat")!
      expect(fatItem.foodId, `day ${day.dayIndex}`).toBe("almonds")
    }
  })

  it("leaves the fat pool unrestricted when the cereal isn't tagged no_cooking_fat (e.g. a paratha)", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        breakfast: [
          { exchangeType: "cereal", count: 1 },
          { exchangeType: "fat", count: 1 },
        ],
      },
      eligibleFoodsBySlot: { breakfast: { cereal: [paratha], fat: [ghee, almonds] } },
    }
    const selection = fallbackSelection(input)
    const foodIds = new Set(
      selection.days.map((d) => d.meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "fat")!.foodId)
    )
    expect(foodIds.has("ghee")).toBe(true)
  })

  it("degrades to the full fat pool when no non-cooking-fat alternative is eligible — never throws", () => {
    const input: FoodSelectorInput = {
      region: "punjabi",
      dietType: "vegetarian",
      mealCount: 5,
      skeleton: {
        breakfast: [
          { exchangeType: "cereal", count: 1 },
          { exchangeType: "fat", count: 1 },
        ],
      },
      eligibleFoodsBySlot: { breakfast: { cereal: [oats], fat: [ghee] } },
    }
    expect(() => fallbackSelection(input)).not.toThrow()
    const selection = fallbackSelection(input)
    for (const day of selection.days) {
      const breakfast = day.meals.find((m) => m.slot === "breakfast")!
      const fatItem = breakfast.items.find((i) => i.exchangeType === "fat")!
      expect(fatItem.foodId).toBe("ghee")
    }
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
