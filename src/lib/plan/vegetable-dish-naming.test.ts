import { describe, expect, it } from "vitest"

import { applyVegetableDishNames } from "./vegetable-dish-naming"
import type { ComposedGroup } from "./meal-composition"
import type { PlanViewItem } from "./plan-guidelines"
import type { ExchangeCode } from "./table-4-1"
import type { VegetableDishCombination, VegetableDishCombinationMember } from "@/db/schema"

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

function makeCombo(overrides: Partial<VegetableDishCombination> & { code: string; displayName: string }): VegetableDishCombination {
  return { id: overrides.id ?? overrides.code, region: overrides.region ?? null, isActive: overrides.isActive ?? true, ...overrides }
}

function makeMember(vegetableDishCombinationId: string, dishFamilyId: string): VegetableDishCombinationMember {
  return { id: `${vegetableDishCombinationId}-${dishFamilyId}`, vegetableDishCombinationId, dishFamilyId }
}

describe("applyVegetableDishNames", () => {
  const avial = makeCombo({ id: "avial", code: "avial", displayName: "Avial", region: "south_indian" })
  const aviaMembers = [
    makeMember("avial", "drumstick-family"),
    makeMember("avial", "ash-gourd-family"),
    makeMember("avial", "yam-family"),
  ]

  it("renames a mixed_dish vegetable group to the curated name on an exact 3-member match", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result).toEqual([{ kind: "mixed_dish", dishName: "Avial", items: [drumstick, ashGourd, yam] }])
  })

  it("does not match when the set has an extra, uncurated vegetable — identity is the exact set, not a superset", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", dishFamilyId: "cabbage-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam, cabbage] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result).toEqual(groups)
  })

  it("does not match a partial subset (missing one of the 3 members)", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd] }]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result).toEqual(groups)
  })

  it("leaves the group unchanged when any item has no dish_family_id", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const untaggedYam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: null })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, untaggedYam] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result).toEqual(groups)
  })

  it("a region-scoped combination only matches its own region", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [drumstick, ashGourd, yam] },
    ]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "north_indian", true)).toEqual(groups)
  })

  it("a null-region combination matches every region", () => {
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", dishFamilyId: "potato-family" })
    const cauliflower = makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", dishFamilyId: "cauliflower-family" })
    const aloogobi = makeCombo({ id: "aloo-gobi", code: "aloo_gobi", displayName: "Aloo Gobi", region: null })
    const members = [makeMember("aloo-gobi", "potato-family"), makeMember("aloo-gobi", "cauliflower-family")]
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [potato, cauliflower] }]
    expect(applyVegetableDishNames(groups, [aloogobi], members, "punjabi", true)[0].dishName).toBe("Aloo Gobi")
  })

  it("ignores an inactive combination", () => {
    const inactiveAvial = makeCombo({ id: "avial", code: "avial", displayName: "Avial", region: "south_indian", isActive: false })
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
    ]
    expect(applyVegetableDishNames(groups, [inactiveAvial], aviaMembers, "south_indian", true)).toEqual(groups)
  })

  it("leaves a single_dish vegetable group (one vegetable only) untouched — this layer only renames mixed_dish groups", () => {
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", dishFamilyId: "cabbage-family" })
    const groups: ComposedGroup[] = [{ kind: "single_dish", dishName: "Cabbage Thoran", items: [cabbage] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)).toEqual(groups)
  })

  it("leaves non-vegetable mixed_dish groups (e.g. a cereal+pulse combo from dish-combination.ts) untouched", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Rajma Chawal", items: [rice, rajma] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)).toEqual(groups)
  })

  it("returns the groups unchanged when there is no mixed_dish vegetable group at all", () => {
    const groups: ComposedGroup[] = [{ kind: "plain", items: [makeItem({ nameEn: "Roti", exchangeType: "cereal" })] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)).toEqual(groups)
  })

  it("with two mixed_dish vegetable groups (sabzi + salad, from meal-composition.ts's salad split), renames only the one that matches — the salad group keeps its generic label since it has no dish_family_id", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const cucumber = makeItem({ nameEn: "Cucumber", exchangeType: "vegetable_a", dishFamilyId: null, tags: ["salad"] })
    const onion = makeItem({ nameEn: "Onion", exchangeType: "vegetable_b", dishFamilyId: null, tags: ["salad"] })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
      { kind: "mixed_dish", dishName: "Salad", items: [cucumber, onion] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result[0].dishName).toBe("Avial")
    expect(result[1].dishName).toBe("Salad")
    expect(result[1].items).toEqual([cucumber, onion])
  })

  it("with two mixed_dish vegetable groups where neither matches, both stay at their generic labels", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", dishFamilyId: "capsicum-family" })
    const tomato = makeItem({ nameEn: "Tomato", exchangeType: "vegetable_a", dishFamilyId: "tomato-family" })
    const onion = makeItem({ nameEn: "Onion", exchangeType: "vegetable_b", dishFamilyId: null, tags: ["salad"] })
    const beetroot = makeItem({ nameEn: "Beetroot", exchangeType: "vegetable_b", dishFamilyId: null, tags: ["salad"] })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [capsicum, tomato] },
      { kind: "mixed_dish", dishName: "Salad", items: [onion, beetroot] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "north_indian", true)
    expect(result).toEqual(groups)
  })

  it("preserves item order and traceability — nothing dropped, nothing invented", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian", true)
    expect(result[0].items).toEqual([drumstick, ashGourd, yam])
    expect(result[0].items[0]).toBe(drumstick)
  })
})

describe("applyVegetableDishNames — allowGenericMixedVeg gate (the 'only 1 day a week' rule)", () => {
  it("splits an uncurated generic 'Mixed Vegetable {word}' group into separate single_dish entries when allowGenericMixedVeg is false", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", dishFamilyId: "capsicum-family", servingRawG: 100 })
    const sweetCorn = makeItem({ nameEn: "Sweet corn", exchangeType: "vegetable_b", dishFamilyId: "sweet-corn-family", servingRawG: 50 })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [capsicum, sweetCorn] }]
    const result = applyVegetableDishNames(groups, [], [], "punjabi", false)
    expect(result).toEqual([
      { kind: "single_dish", dishName: "Capsicum Sabzi", items: [capsicum] },
      { kind: "single_dish", dishName: "Sweet corn Sabzi", items: [sweetCorn] },
    ])
  })

  it("keeps the generic label intact when allowGenericMixedVeg is true — the designated mixed-veg day", () => {
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", dishFamilyId: "capsicum-family" })
    const sweetCorn = makeItem({ nameEn: "Sweet corn", exchangeType: "vegetable_b", dishFamilyId: "sweet-corn-family" })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [capsicum, sweetCorn] }]
    expect(applyVegetableDishNames(groups, [], [], "punjabi", true)).toEqual(groups)
  })

  it("a curated match still wins over the day gate — Aloo Gobi shows on any day, not just the designated one", () => {
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", dishFamilyId: "potato-family" })
    const cauliflower = makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", dishFamilyId: "cauliflower-family" })
    const aloogobi = makeCombo({ id: "aloo-gobi", code: "aloo_gobi", displayName: "Aloo Gobi", region: null })
    const members = [makeMember("aloo-gobi", "potato-family"), makeMember("aloo-gobi", "cauliflower-family")]
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [potato, cauliflower] }]
    const result = applyVegetableDishNames(groups, [aloogobi], members, "punjabi", false)
    expect(result).toEqual([{ kind: "mixed_dish", dishName: "Aloo Gobi", items: [potato, cauliflower] }])
  })

  it("a 3-vegetable uncurated group splits into 3 separate single_dish entries, each keeping its own gram total", () => {
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", dishFamilyId: "cabbage-family", servingRawG: 100 })
    const capsicum = makeItem({ nameEn: "Capsicum", exchangeType: "vegetable_a", dishFamilyId: "capsicum-family", servingRawG: 100 })
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", dishFamilyId: "potato-family", servingRawG: 75 })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [cabbage, capsicum, potato] }]
    const result = applyVegetableDishNames(groups, [], [], "punjabi", false)
    expect(result).toHaveLength(3)
    expect(result.map((g) => g.dishName)).toEqual(["Cabbage Sabzi", "Capsicum Sabzi", "Potato Sabzi"])
  })

  it("the Salad group (dishName exactly 'Salad', not the generic Mixed Vegetable prefix) is never split by this gate", () => {
    const onion = makeItem({ nameEn: "Onion", exchangeType: "vegetable_b", dishFamilyId: null, tags: ["salad"] })
    const beetroot = makeItem({ nameEn: "Beetroot", exchangeType: "vegetable_b", dishFamilyId: null, tags: ["salad"] })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Salad", items: [onion, beetroot] }]
    expect(applyVegetableDishNames(groups, [], [], "punjabi", false)).toEqual(groups)
  })
})
