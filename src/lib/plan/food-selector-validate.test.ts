import { describe, expect, it } from "vitest"

import { checkArchetypeAdherence, validateSelection } from "./food-selector-validate"
import type { Skeleton } from "./meal-distributor"
import { makeFood } from "./test-fixtures"
import type { ArchetypeAssignment } from "./archetype-selector"
import type { FoodSelectorInput, Selection, SelectedDay } from "./food-selector-types"

/** No jitter in these fixtures — every day gets the identical skeleton, reproducing pre-jitter behavior exactly. */
function sevenSkeletons(skeleton: Skeleton): Skeleton[] {
  return new Array(7).fill(skeleton)
}

const roti = makeFood({ id: "roti", nameEn: "Roti", exchangeType: "cereal" })
const rice = makeFood({ id: "rice", nameEn: "Rice", exchangeType: "cereal" })
const palak = makeFood({ id: "palak", nameEn: "Palak", exchangeType: "vegetable_a" })
const bhindi = makeFood({ id: "bhindi", nameEn: "Bhindi", exchangeType: "vegetable_a" })
const moongDal = makeFood({ id: "moong_dal", nameEn: "Moong Dal", exchangeType: "pulse" })
const chanaDal = makeFood({ id: "chana_dal", nameEn: "Chana Dal", exchangeType: "pulse" })
const rajma = makeFood({ id: "rajma", nameEn: "Rajma", exchangeType: "pulse" })
const urad = makeFood({ id: "urad", nameEn: "Urad Dal", exchangeType: "pulse" })
const apple = makeFood({ id: "apple", nameEn: "Apple", exchangeType: "fruit" })
const banana = makeFood({ id: "banana", nameEn: "Banana", exchangeType: "fruit" })
const mango = makeFood({ id: "mango", nameEn: "Mango", exchangeType: "fruit" })
const orange = makeFood({ id: "orange", nameEn: "Orange", exchangeType: "fruit" })

const CEREALS = [roti, rice]
const PULSES = [moongDal, chanaDal, rajma, urad]
const FRUITS = [apple, banana, mango, orange]

const input: FoodSelectorInput = {
  region: "north_indian",
  dietType: "vegetarian",
  mealCount: 5,
  skeletonsByDay: sevenSkeletons({
    breakfast: [
      { exchangeType: "cereal", count: 2 },
      { exchangeType: "fruit", count: 1 },
    ],
    dinner: [
      { exchangeType: "vegetable_a", count: 2 },
      { exchangeType: "pulse", count: 1 },
      { exchangeType: "fruit", count: 1 },
    ],
  }),
  eligibleFoodsBySlot: {
    breakfast: { cereal: CEREALS, fruit: FRUITS },
    dinner: { vegetable_a: [palak, bhindi], pulse: PULSES, fruit: FRUITS },
  },
}

/**
 * Hand-built rather than sourced from fallbackSelection() — deliberately
 * decoupled from that module's rotation heuristics so these tests only
 * depend on validateSelection()'s own rules. Cereal alternates every day
 * (never repeats consecutively), pulse cycles through 4 foods (each used
 * <=2 of the 7 days), and the two fruit slots are always 2 apart in a
 * 4-item cycle (so they're never equal within the same day).
 */
function buildValidSelection(): Selection {
  const days: SelectedDay[] = []
  for (let d = 0; d < 7; d++) {
    days.push({
      dayIndex: d,
      meals: [
        {
          slot: "breakfast",
          items: [
            { foodId: CEREALS[d % 2].id, exchangeType: "cereal", exchangeCount: 2 },
            { foodId: FRUITS[d % 4].id, exchangeType: "fruit", exchangeCount: 1 },
          ],
        },
        {
          slot: "dinner",
          items: [
            { foodId: palak.id, exchangeType: "vegetable_a", exchangeCount: 1 },
            { foodId: bhindi.id, exchangeType: "vegetable_a", exchangeCount: 1 },
            { foodId: PULSES[d % 4].id, exchangeType: "pulse", exchangeCount: 1 },
            { foodId: FRUITS[(d + 2) % 4].id, exchangeType: "fruit", exchangeCount: 1 },
          ],
        },
      ],
    })
  }
  return { days }
}

describe("validateSelection — accepts well-formed selections", () => {
  it("returns no errors for a correctly rotated 7-day selection", () => {
    expect(validateSelection(buildValidSelection(), input)).toEqual([])
  })
})

describe("validateSelection — structural violations", () => {
  it("flags a missing day", () => {
    const selection = buildValidSelection()
    selection.days = selection.days.filter((d) => d.dayIndex !== 3)
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("dayIndex 3 is missing"))).toBe(true)
  })

  it("flags a missing slot within a day", () => {
    const selection = buildValidSelection()
    selection.days[0].meals = selection.days[0].meals.filter((m) => m.slot !== "dinner")
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes('slot "dinner" is missing'))).toBe(true)
  })

  it("flags an unknown slot", () => {
    const selection = buildValidSelection()
    selection.days[0].meals.push({ slot: "bedtime", items: [{ foodId: apple.id, exchangeType: "fruit", exchangeCount: 1 }] })
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes('unknown slot "bedtime"'))).toBe(true)
  })

  it("flags a food not in the eligible set", () => {
    const selection = buildValidSelection()
    selection.days[0].meals.find((m) => m.slot === "breakfast")!.items[0].foodId = "not-a-real-food"
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("is not in the eligible set"))).toBe(true)
  })

  it("flags an exchangeCount total that doesn't match the skeleton", () => {
    const selection = buildValidSelection()
    selection.days[0].meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "cereal")!.exchangeCount = 3
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("cereal total is 3, skeleton requires exactly 2"))).toBe(true)
  })

  it("flags a food whose real exchange type doesn't match the item's label", () => {
    const selection = buildValidSelection()
    selection.days[0].meals.find((m) => m.slot === "dinner")!.items.find((i) => i.foodId === moongDal.id)!.exchangeType =
      "vegetable_a"
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("is exchange type pulse, not vegetable_a as labelled"))).toBe(true)
  })
})

describe("validateSelection — rotation rule violations", () => {
  it("flags the same cereal food repeating on consecutive days in the same slot", () => {
    const selection = buildValidSelection()
    const day0Cereal = selection.days[0].meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "cereal")!
    const day1Cereal = selection.days[1].meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "cereal")!
    day1Cereal.foodId = day0Cereal.foodId
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("repeats in slot"))).toBe(true)
  })

  it("flags the same pulse food used on more than 2 days", () => {
    const selection = buildValidSelection()
    for (const day of selection.days) {
      day.meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "pulse")!.foodId = moongDal.id
    }
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes(`pulse food ${moongDal.id} is used on 7 days`))).toBe(true)
  })

  it("flags the same fruit repeating across slots within a day", () => {
    const selection = buildValidSelection()
    const breakfastFruit = selection.days[0].meals.find((m) => m.slot === "breakfast")!.items.find((i) => i.exchangeType === "fruit")!
    const dinnerFruit = selection.days[0].meals.find((m) => m.slot === "dinner")!.items.find((i) => i.exchangeType === "fruit")!
    dinnerFruit.foodId = breakfastFruit.foodId
    const errors = validateSelection(selection, input)
    expect(errors.some((e) => e.includes("is repeated across slots on the same day"))).toBe(true)
  })
})

describe("checkArchetypeAdherence", () => {
  const idli = makeFood({ id: "idli", nameEn: "Idli", exchangeType: "cereal", dishFamilyId: "idli-family" })
  const dosa = makeFood({ id: "dosa", nameEn: "Dosa", exchangeType: "cereal", dishFamilyId: "dosa-family" })
  const sambar = makeFood({ id: "sambar", nameEn: "Sambar", exchangeType: "pulse", dishFamilyId: "sambar-family" })
  const masoorDalFood = makeFood({ id: "masoor2", nameEn: "Masoor Dal", exchangeType: "pulse", dishFamilyId: "masoor-family" })

  const archetypeInput: FoodSelectorInput = {
    region: "south_indian",
    dietType: "vegetarian",
    mealCount: 5,
    skeletonsByDay: sevenSkeletons({ breakfast: [{ exchangeType: "cereal", count: 2 }, { exchangeType: "pulse", count: 0.5 }] }),
    eligibleFoodsBySlot: { breakfast: { cereal: [idli, dosa], pulse: [sambar, masoorDalFood] } },
  }

  const idliSambarAssignment: ArchetypeAssignment = {
    slot: "breakfast",
    archetypeId: "idli-sambar",
    archetypeCode: "south_indian_idli_sambar",
    archetypeName: "Idli with Sambar",
    components: [
      { role: "steamed_batter_cereal", dishFamilyIds: ["idli-family"], exchangeType: "cereal", isRequired: true },
      { role: "lentil_curry", dishFamilyIds: ["sambar-family"], exchangeType: "pulse", isRequired: true },
    ],
  }

  function selectionWith(cerealFoodId: string, pulseFoodId: string): Selection {
    return {
      days: [
        {
          dayIndex: 0,
          meals: [
            {
              slot: "breakfast",
              items: [
                { foodId: cerealFoodId, exchangeType: "cereal", exchangeCount: 2 },
                { foodId: pulseFoodId, exchangeType: "pulse", exchangeCount: 0.5 },
              ],
            },
          ],
        },
      ],
    }
  }

  it("reports 'full' adherence when every required component's food matches the archetype's dish families", () => {
    const result = checkArchetypeAdherence(selectionWith(idli.id, sambar.id), [[idliSambarAssignment]], archetypeInput)
    expect(result).toEqual([
      {
        dayIndex: 0,
        slot: "breakfast",
        archetypeId: "idli-sambar",
        archetypeCode: "south_indian_idli_sambar",
        adherence: "full",
        matchedComponents: 2,
        totalComponents: 2,
      },
    ])
  })

  it("reports 'partial' adherence when only one required component matches", () => {
    const result = checkArchetypeAdherence(selectionWith(idli.id, masoorDalFood.id), [[idliSambarAssignment]], archetypeInput)
    expect(result[0].adherence).toBe("partial")
    expect(result[0].matchedComponents).toBe(1)
  })

  it("reports 'none' when no required component matches", () => {
    const result = checkArchetypeAdherence(selectionWith(dosa.id, masoorDalFood.id), [[idliSambarAssignment]], archetypeInput)
    expect(result[0].adherence).toBe("none")
    expect(result[0].matchedComponents).toBe(0)
  })

  it("returns an empty array when no slot has an archetype assignment (archetypeId: null everywhere)", () => {
    const noArchetype: ArchetypeAssignment = { slot: "breakfast", archetypeId: null, archetypeCode: null, archetypeName: null, components: [] }
    const result = checkArchetypeAdherence(selectionWith(dosa.id, masoorDalFood.id), [[noArchetype]], archetypeInput)
    expect(result).toEqual([])
  })

  it("is purely informational — an off-archetype selection that is otherwise well-formed still produces zero errors from validateSelection", () => {
    const offArchetype = selectionWith(dosa.id, masoorDalFood.id)
    // Sanity: this selection intentionally mismatches the archetype (Q above
    // confirms adherence: "none"), yet the hard structural/rotation
    // validator must not know or care about archetypes at all.
    const singleDayInput: FoodSelectorInput = { ...archetypeInput, mealCount: 5 }
    const errors = validateSelection(offArchetype, singleDayInput).filter((e) => !e.includes("is missing from the response"))
    expect(errors).toEqual([])
  })
})
