/**
 * Dish Composition Layer, stage 3 — runs strictly AFTER
 * meal-composition.ts's composeMealDisplay() (and independently of
 * dish-combination.ts's cereal+pulse merge; the two never touch the same
 * group). Renames a "mixed_dish" vegetable group produced by that pooling
 * step from the generic "Mixed Vegetable {RegionWord}" to a curated dish
 * name — e.g. Drumstick + Ash gourd + Yam -> "Avial" — when the EXACT set
 * of vegetables present matches a seeded vegetable_dish_combinations row.
 *
 * composeMealDisplay() can now produce up to TWO vegetable mixed_dish
 * groups in one meal (a cooked-sabzi pool and a separate salad pool — see
 * its own doc comment), so every matching group is checked independently
 * rather than assuming there's at most one. In practice the salad pool
 * never matches (its foods carry no dish_family_id by design — curated
 * naming is for cooked combos like Aloo Gobi, not salad), so it keeps its
 * generic "Salad (...)" label; this just makes that fall out correctly
 * rather than relying on group order.
 *
 * Exact-set match only, not "curated members present among others": a
 * curated identity like Avial means those specific vegetables together,
 * not those vegetables plus an unrelated extra one diluting it. Only ever
 * renames a matched group; never adds, drops, or reorders items, and never
 * touches an exchange count, quantity, or macro number.
 *
 * No match — e.g. vegetable_a's Capsicum landing alongside vegetable_b's
 * Sweet corn that day, an uncurated pairing — is where `allowGenericMixedVeg`
 * (isMixedVegDay(), from mixed-veg-day.ts, computed by the caller from the
 * plan's real day/week) comes in: on the week's one designated mixed-veg
 * day this still renders as the generic "Mixed Vegetable {word}" label
 * (unchanged); on every other day it's split back into 2 separate
 * single_dish groups instead — vegetable_a and vegetable_b pooling into one
 * combined dish is itself what reads as "arbitrary mix veg" when it isn't a
 * recognizable named combo, same complaint as food-selector-fallback.ts's
 * vegetable_a-vs-vegetable_a case, just arriving from a different pairing
 * of exchange types. Splitting reuses each item's own nameEn + the word
 * recovered from the generic label itself (GENERIC_MIXED_VEG_PREFIX), so no
 * region-word lookup is duplicated here.
 */

import type { VegetableDishCombination, VegetableDishCombinationMember } from "@/db/schema"
import { GENERIC_MIXED_VEG_PREFIX, type ComposedGroup } from "./meal-composition"

const VEGETABLE_TYPES = new Set(["vegetable_a", "vegetable_b"])

function isVegetableMixedDish(group: ComposedGroup): boolean {
  return group.kind === "mixed_dish" && group.items.every((item) => item.exchangeType !== null && VEGETABLE_TYPES.has(item.exchangeType))
}

export function applyVegetableDishNames(
  groups: ComposedGroup[],
  combinations: VegetableDishCombination[],
  members: VegetableDishCombinationMember[],
  region: string,
  allowGenericMixedVeg: boolean
): ComposedGroup[] {
  const hasVegetableMixedDish = groups.some(isVegetableMixedDish)
  if (!hasVegetableMixedDish) return groups

  const membersByCombo = new Map<string, Set<string>>()
  for (const m of members) {
    const set = membersByCombo.get(m.vegetableDishCombinationId) ?? new Set<string>()
    set.add(m.dishFamilyId)
    membersByCombo.set(m.vegetableDishCombinationId, set)
  }

  return groups.flatMap((group) => {
    if (!isVegetableMixedDish(group)) return [group]

    const familyIds = group.items.map((i) => i.dishFamilyId)
    const match = familyIds.some((id) => id === null)
      ? undefined
      : combinations.find((c) => {
          if (!c.isActive) return false
          if (c.region !== null && c.region !== region) return false
          const familyIdSet = new Set(familyIds as string[])
          const memberIds = membersByCombo.get(c.id)
          if (!memberIds || memberIds.size !== familyIdSet.size) return false
          for (const id of memberIds) if (!familyIdSet.has(id)) return false
          return true
        })

    if (match) return [{ ...group, dishName: match.displayName }]

    if (!allowGenericMixedVeg && group.dishName?.startsWith(GENERIC_MIXED_VEG_PREFIX)) {
      const word = group.dishName.slice(GENERIC_MIXED_VEG_PREFIX.length)
      return group.items.map((item) => ({ kind: "single_dish" as const, dishName: `${item.nameEn} ${word}`, items: [item] }))
    }

    return [group]
  })
}
