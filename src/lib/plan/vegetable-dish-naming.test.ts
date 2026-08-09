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
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")
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
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")
    expect(result).toEqual(groups)
  })

  it("does not match a partial subset (missing one of the 3 members)", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd] }]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")
    expect(result).toEqual(groups)
  })

  it("leaves the group unchanged when any item has no dish_family_id", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const untaggedYam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: null })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, untaggedYam] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")
    expect(result).toEqual(groups)
  })

  it("a region-scoped combination only matches its own region", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [drumstick, ashGourd, yam] },
    ]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "north_indian")).toEqual(groups)
  })

  it("a null-region combination matches every region", () => {
    const potato = makeItem({ nameEn: "Potato", exchangeType: "vegetable_b", dishFamilyId: "potato-family" })
    const cauliflower = makeItem({ nameEn: "Cauliflower", exchangeType: "vegetable_a", dishFamilyId: "cauliflower-family" })
    const aloogobi = makeCombo({ id: "aloo-gobi", code: "aloo_gobi", displayName: "Aloo Gobi", region: null })
    const members = [makeMember("aloo-gobi", "potato-family"), makeMember("aloo-gobi", "cauliflower-family")]
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Mixed Vegetable Sabzi", items: [potato, cauliflower] }]
    expect(applyVegetableDishNames(groups, [aloogobi], members, "punjabi")[0].dishName).toBe("Aloo Gobi")
  })

  it("ignores an inactive combination", () => {
    const inactiveAvial = makeCombo({ id: "avial", code: "avial", displayName: "Avial", region: "south_indian", isActive: false })
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
    ]
    expect(applyVegetableDishNames(groups, [inactiveAvial], aviaMembers, "south_indian")).toEqual(groups)
  })

  it("leaves a single_dish vegetable group (one vegetable only) untouched — this layer only renames mixed_dish groups", () => {
    const cabbage = makeItem({ nameEn: "Cabbage", exchangeType: "vegetable_a", dishFamilyId: "cabbage-family" })
    const groups: ComposedGroup[] = [{ kind: "single_dish", dishName: "Cabbage Thoran", items: [cabbage] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")).toEqual(groups)
  })

  it("leaves non-vegetable mixed_dish groups (e.g. a cereal+pulse combo from dish-combination.ts) untouched", () => {
    const rice = makeItem({ nameEn: "Rice", exchangeType: "cereal", dishFamilyId: "rice-family" })
    const rajma = makeItem({ nameEn: "Rajma", exchangeType: "pulse", dishFamilyId: "rajma-family" })
    const groups: ComposedGroup[] = [{ kind: "mixed_dish", dishName: "Rajma Chawal", items: [rice, rajma] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")).toEqual(groups)
  })

  it("returns the groups unchanged when there is no mixed_dish vegetable group at all", () => {
    const groups: ComposedGroup[] = [{ kind: "plain", items: [makeItem({ nameEn: "Roti", exchangeType: "cereal" })] }]
    expect(applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")).toEqual(groups)
  })

  it("preserves item order and traceability — nothing dropped, nothing invented", () => {
    const drumstick = makeItem({ nameEn: "Drumstick", exchangeType: "vegetable_a", dishFamilyId: "drumstick-family" })
    const ashGourd = makeItem({ nameEn: "Ash gourd", exchangeType: "vegetable_a", dishFamilyId: "ash-gourd-family" })
    const yam = makeItem({ nameEn: "Yam", exchangeType: "vegetable_b", dishFamilyId: "yam-family" })
    const groups: ComposedGroup[] = [
      { kind: "mixed_dish", dishName: "Mixed Vegetable Thoran", items: [drumstick, ashGourd, yam] },
    ]
    const result = applyVegetableDishNames(groups, [avial], aviaMembers, "south_indian")
    expect(result[0].items).toEqual([drumstick, ashGourd, yam])
    expect(result[0].items[0]).toBe(drumstick)
  })
})
