import { describe, expect, it } from "vitest"

import { combineDishGroups } from "./dish-combination"
import type { ComposedGroup } from "./meal-composition"
import type { PlanViewItem } from "./plan-guidelines"
import type { ExchangeCode } from "./table-4-1"
import type { DishCombination } from "@/db/schema"

let counter = 0
function makeItem(overrides: Partial<PlanViewItem> & { nameEn: string; exchangeType: ExchangeCode }): PlanViewItem {
  counter += 1
  return {
    id: overrides.id ?? `item-${counter}`,
    foodId: overrides.foodId ?? `food-${counter}`,
    householdMeasure: null,
    servingRawG: 100,
    exchangeCount: 1,
    kcal: 40,
    proteinG: 1,
    carbsG: 3.5,
    fatG: 0,
    dishFamilyId: null,
    tags: [],
    ...overrides,
  }
}

function makeCombo(overrides: Partial<DishCombination> & { primaryDishFamilyId: string; secondaryDishFamilyId: string }): DishCombination {
  return {
    id: overrides.id ?? "combo-1",
    code: overrides.code ?? "combo",
    displayName: overrides.displayName ?? "Combo Dish",
    region: overrides.region ?? null,
    isActive: overrides.isActive ?? true,
    ...overrides,
  }
}

const NO_ARCHETYPE_FAMILIES: Partial<Record<ExchangeCode, string[]>> = {}

describe("combineDishGroups — archetype-name merge", () => {
  it("merges under the archetype's own name when the SPECIFIC selected foods match its declared families", () => {
    const idli = makeItem({ nameEn: "Idli", exchangeType: "cereal", dishFamilyId: "idli-family" })
    const sambar = makeItem({ nameEn: "Sambar", exchangeType: "pulse", dishFamilyId: "sambar-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [idli] },
      { kind: "single_dish", dishName: "Sambar Curry", items: [sambar] },
    ]
    const archetypeFamilies = { cereal: ["idli-family"], pulse: ["sambar-family"] }
    const result = combineDishGroups(groups, "Idli with Sambar", archetypeFamilies, [], "south_indian")
    expect(result).toEqual([{ kind: "mixed_dish", dishName: "Idli with Sambar", items: [idli, sambar] }])
  })

  it("archetype name takes priority even when a dish_combinations match also exists", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rajma] },
    ]
    const combos = [makeCombo({ primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Rajma Chawal" })]
    const archetypeFamilies = { cereal: ["rice-family"], pulse: ["rajma-family"] }
    const result = combineDishGroups(groups, "Some Archetype Name", archetypeFamilies, combos, "north_indian")
    expect(result[0].dishName).toBe("Some Archetype Name")
  })

  it("does NOT merge when the archetype declares a pulse role but the SPECIFIC food selected belongs to a different family — the weekly-union drift case", () => {
    // e.g. a lunch labelled "Sambar Rice Meal" (pulse family = sambar-family)
    // where the weekly-union-narrowed fallback pool actually landed on
    // Parippu (a different family) that day — merging on name alone would
    // render the wrong dish, "Sambar Rice Meal (Rice, Parippu)".
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const parippu = makeItem({ nameEn: "Parippu", exchangeType: "pulse", dishFamilyId: "parippu-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Parippu Curry", items: [parippu] },
    ]
    const archetypeFamilies = { cereal: ["rice-family"], pulse: ["sambar-family"] }
    const result = combineDishGroups(groups, "Sambar Rice Meal", archetypeFamilies, [], "south_indian")
    expect(result).toEqual(groups)
  })

  it("does NOT merge when the archetype's cereal role doesn't match either, even if the pulse does", () => {
    const chapati = makeItem({ nameEn: "Chapati", exchangeType: "cereal", dishFamilyId: "chapati-family" })
    const moongDal = makeItem({ nameEn: "Moong dal", exchangeType: "pulse", dishFamilyId: "moong-dal-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [chapati] },
      { kind: "single_dish", dishName: "Moong dal Curry", items: [moongDal] },
    ]
    // Archetype expects rice, not chapati, for its cereal role.
    const archetypeFamilies = { cereal: ["rice-family"], pulse: ["moong-dal-family"] }
    const result = combineDishGroups(groups, "Sambar Rice Meal", archetypeFamilies, [], "south_indian")
    expect(result).toEqual(groups)
  })

  it("does NOT merge under the archetype name when the archetype has no pulse role at all — a coincidental pulse in the same slot is not that archetype's dish", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const sambar = makeItem({ nameEn: "Sambar", exchangeType: "pulse", dishFamilyId: "sambar-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Sambar Curry", items: [sambar] },
    ]
    // Vegetable Kurma Meal declares only a cereal role, no pulse role.
    const archetypeFamilies = { cereal: ["rice-family"] }
    const result = combineDishGroups(groups, "Vegetable Kurma Meal", archetypeFamilies, [], "south_indian")
    expect(result).toEqual(groups)
  })

  it("falls through to a dish_combinations lookup when the archetype doesn't match but the pair still has a real curated match", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rajma] },
    ]
    const combos = [makeCombo({ primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Rajma Chawal" })]
    const archetypeFamilies = { cereal: ["rice-family"] } // no pulse role
    const result = combineDishGroups(groups, "Vegetable Kurma Meal", archetypeFamilies, combos, "north_indian")
    expect(result[0].dishName).toBe("Rajma Chawal")
  })

  it("does nothing when an archetype name is present but there's no pulse group to merge with", () => {
    const idli = makeItem({ nameEn: "Idli", exchangeType: "cereal", dishFamilyId: "idli-family" })
    const coconutOil = makeItem({ nameEn: "Coconut oil", exchangeType: "fat" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [idli] },
      { kind: "plain", items: [coconutOil] },
    ]
    const archetypeFamilies = { cereal: ["idli-family"], pulse: ["sambar-family"] }
    const result = combineDishGroups(groups, "Idli with Sambar", archetypeFamilies, [], "south_indian")
    expect(result).toEqual(groups)
  })
})

describe("combineDishGroups — dish_combinations lookup (no archetype)", () => {
  const rice = () => makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
  const rajma = () => makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
  const moongDal = () => makeItem({ nameEn: "Moong Dal", exchangeType: "pulse", dishFamilyId: "moong-dal-family" })

  const combos = [
    makeCombo({ code: "rajma_chawal", primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Rajma Chawal" }),
    makeCombo({ code: "moong_dal_rice", primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "moong-dal-family", displayName: "Moong Dal Rice" }),
  ]

  it("Rajma + Rice -> Rajma Chawal", () => {
    const r = rice()
    const rj = rajma()
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [r] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rj] },
    ]
    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")
    expect(result).toEqual([{ kind: "mixed_dish", dishName: "Rajma Chawal", items: [r, rj] }])
  })

  it("Moong Dal + Rice -> Moong Dal Rice", () => {
    const r = rice()
    const md = moongDal()
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [r] },
      { kind: "single_dish", dishName: "Moong Dal Curry", items: [md] },
    ]
    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")
    expect(result[0].dishName).toBe("Moong Dal Rice")
  })

  it("leaves groups unchanged when no combination row matches the pair", () => {
    const r = rice()
    const unmatchedPulse = makeItem({ nameEn: "Chana Dal", exchangeType: "pulse", dishFamilyId: "chana-dal-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [r] },
      { kind: "single_dish", dishName: "Chana Dal Curry", items: [unmatchedPulse] },
    ]
    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")
    expect(result).toEqual(groups)
  })

  it("leaves groups unchanged when either food has no dish_family_id at all", () => {
    const untaggedRice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: null })
    const rj = rajma()
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [untaggedRice] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rj] },
    ]
    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")
    expect(result).toEqual(groups)
  })

  it("a region-scoped combination only matches its own region", () => {
    const r = rice()
    const rj = rajma()
    const regional = [makeCombo({ primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Punjabi Rajma Chawal", region: "punjabi" })]

    const groupsA: ComposedGroup[] = [{ kind: "plain", items: [r] }, { kind: "single_dish", dishName: "Rajma Curry", items: [rj] }]
    expect(combineDishGroups(groupsA, null, NO_ARCHETYPE_FAMILIES, regional, "punjabi")[0].dishName).toBe("Punjabi Rajma Chawal")

    const r2 = rice()
    const rj2 = rajma()
    const groupsB: ComposedGroup[] = [{ kind: "plain", items: [r2] }, { kind: "single_dish", dishName: "Rajma Curry", items: [rj2] }]
    expect(combineDishGroups(groupsB, null, NO_ARCHETYPE_FAMILIES, regional, "north_indian")).toEqual(groupsB)
  })

  it("leaves groups unchanged when there's no cereal group, no pulse group, or neither", () => {
    const onlyRice: ComposedGroup[] = [{ kind: "plain", items: [rice()] }]
    expect(combineDishGroups(onlyRice, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")).toEqual(onlyRice)

    const onlyRajma: ComposedGroup[] = [{ kind: "single_dish", dishName: "Rajma Curry", items: [rajma()] }]
    expect(combineDishGroups(onlyRajma, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")).toEqual(onlyRajma)

    expect(combineDishGroups([], null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")).toEqual([])
  })
})

describe("combineDishGroups — other groups pass through, order and traceability preserved", () => {
  it("keeps vegetable/fruit/fat/milk groups untouched and inserts the combined dish at the earlier group's position", () => {
    const milk = makeItem({ nameEn: "Milk", exchangeType: "milk_cow" })
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a" })

    const groups: ComposedGroup[] = [
      { kind: "plain", items: [milk] },
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rajma] },
      { kind: "single_dish", dishName: "Cabbage Sabzi", items: [cabbage] },
    ]
    const combos = [makeCombo({ primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Rajma Chawal" })]

    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")

    expect(result).toEqual([
      { kind: "plain", items: [milk] },
      { kind: "mixed_dish", dishName: "Rajma Chawal", items: [rice, rajma] },
      { kind: "single_dish", dishName: "Cabbage Sabzi", items: [cabbage] },
    ])
  })

  it("the merged group's items are exactly the cereal item plus the pulse item — nothing dropped, nothing duplicated, nothing invented", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const groups: ComposedGroup[] = [
      { kind: "plain", items: [rice] },
      { kind: "single_dish", dishName: "Rajma Curry", items: [rajma] },
    ]
    const combos = [makeCombo({ primaryDishFamilyId: "rice-family", secondaryDishFamilyId: "rajma-family", displayName: "Rajma Chawal" })]

    const result = combineDishGroups(groups, null, NO_ARCHETYPE_FAMILIES, combos, "north_indian")
    expect(result[0].items).toEqual([rice, rajma])
    expect(result[0].items[0]).toBe(rice)
    expect(result[0].items[1]).toBe(rajma)
  })
})
