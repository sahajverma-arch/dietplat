/**
 * Dish Composition Layer, stage 3 — runs strictly AFTER
 * meal-composition.ts's composeMealDisplay() (and independently of
 * dish-combination.ts's cereal+pulse merge; the two never touch the same
 * group). Renames a "mixed_dish" vegetable group produced by that pooling
 * step from the generic "Mixed Vegetable {RegionWord}" to a curated dish
 * name — e.g. Drumstick + Ash gourd + Yam -> "Avial" — when the EXACT set
 * of vegetables present matches a seeded vegetable_dish_combinations row.
 *
 * Exact-set match only, not "curated members present among others": a
 * curated identity like Avial means those specific vegetables together,
 * not those vegetables plus an unrelated extra one diluting it. No match
 * (including when any item lacks a dish_family_id) leaves the group
 * exactly as composeMealDisplay() produced it — today's generic label,
 * unchanged. Only ever renames; never adds, drops, or reorders items, and
 * never touches an exchange count, quantity, or macro number.
 */

import type { VegetableDishCombination, VegetableDishCombinationMember } from "@/db/schema"
import type { ComposedGroup } from "./meal-composition"

const VEGETABLE_TYPES = new Set(["vegetable_a", "vegetable_b"])

function findVegetableMixedDishIndex(groups: ComposedGroup[]): number {
  return groups.findIndex((g) => g.kind === "mixed_dish" && g.items.every((i) => VEGETABLE_TYPES.has(i.exchangeType)))
}

export function applyVegetableDishNames(
  groups: ComposedGroup[],
  combinations: VegetableDishCombination[],
  members: VegetableDishCombinationMember[],
  region: string
): ComposedGroup[] {
  const index = findVegetableMixedDishIndex(groups)
  if (index === -1) return groups

  const group = groups[index]
  const familyIds = group.items.map((i) => i.dishFamilyId)
  if (familyIds.some((id) => id === null)) return groups
  const familyIdSet = new Set(familyIds as string[])

  const membersByCombo = new Map<string, Set<string>>()
  for (const m of members) {
    const set = membersByCombo.get(m.vegetableDishCombinationId) ?? new Set<string>()
    set.add(m.dishFamilyId)
    membersByCombo.set(m.vegetableDishCombinationId, set)
  }

  const match = combinations.find((c) => {
    if (!c.isActive) return false
    if (c.region !== null && c.region !== region) return false
    const memberIds = membersByCombo.get(c.id)
    if (!memberIds || memberIds.size !== familyIdSet.size) return false
    for (const id of memberIds) if (!familyIdSet.has(id)) return false
    return true
  })
  if (!match) return groups

  const updated = [...groups]
  updated[index] = { ...group, dishName: match.displayName }
  return updated
}
