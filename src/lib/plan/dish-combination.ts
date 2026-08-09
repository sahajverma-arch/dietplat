/**
 * Dish Composition Layer, stage 2 — runs strictly AFTER
 * meal-composition.ts's composeMealDisplay(), consuming its ComposedGroup[]
 * output. Merges an already-composed cereal group with an already-composed
 * pulse dish into one named combo (e.g. "Rice" + "Rajma Curry" -> "Rajma
 * Chawal"), so generated plans read like a meal a dietitian would write
 * instead of two separately-labelled exchange buckets sitting side by
 * side.
 *
 * Two sources of a combined name, tried in order:
 *  1. The meal's own meal_archetype name (already decided and persisted at
 *     generation time — see diet_plan_meals.archetype_id), when the
 *     SPECIFIC cereal and pulse foods actually selected both belong to
 *     that archetype's own declared dish_family_ids —
 *     `archetypeDishFamilyIdsByExchangeType`, keyed by exchange type.
 *     "Does the archetype have a pulse role at all" is not enough: the
 *     weekly-union narrowing (eligibleFoodsBySlot is day-invariant, see
 *     route.ts) means the food actually picked on a given day can drift
 *     from what that day's archetype intended
 *     (checkArchetypeAdherence's "partial" case) — a lunch labelled
 *     "Sambar Rice Meal" can end up with Parippu selected instead of
 *     Sambar. Merging on name alone would render "Sambar Rice Meal
 *     (Rice, Parippu)", which is simply wrong; verifying the actual
 *     dish_family_id against the archetype's own declared set catches
 *     this. (This also covers the narrower case of a no-pulse archetype
 *     like "Vegetable Kurma Meal" picking up a coincidental pulse item —
 *     its pulse key is simply absent, so no family id can ever match.)
 *  2. A curated dish_combinations lookup, matched by the underlying
 *     foods' dish_family_id — the same closed-vocabulary discipline
 *     dish_families/archetype_components already established, not a
 *     generic "{pulse} {cereal}" formula (real dish names don't reduce to
 *     one word-order rule — "Rajma Chawal" substitutes "Chawal" for
 *     "Rice", "Idli Sambar" drops the "Curry" suffix, etc. — guessing
 *     would occasionally produce something a dietitian would never
 *     write).
 *
 * If neither applies, the groups are returned exactly as
 * composeMealDisplay() produced them — today's behaviour, unchanged. This
 * function only ever reads ComposedGroup.items (already-priced,
 * already-validated PlanViewItem[]) and never touches a kcal/macro number,
 * an exchange count, or which foods were selected.
 */

import type { DishCombination } from "@/db/schema"
import type { ComposedGroup } from "./meal-composition"
import type { ExchangeCode } from "./table-4-1"

function findCerealGroupIndex(groups: ComposedGroup[]): number {
  return groups.findIndex((g) => g.kind === "plain" && g.items[0].exchangeType === "cereal")
}

function findPulseGroupIndex(groups: ComposedGroup[]): number {
  return groups.findIndex((g) => g.kind === "single_dish" && g.items[0].exchangeType === "pulse")
}

function mergeGroups(groups: ComposedGroup[], cerealIndex: number, pulseIndex: number, displayName: string): ComposedGroup[] {
  const combined: ComposedGroup = {
    kind: "mixed_dish",
    dishName: displayName,
    items: [...groups[cerealIndex].items, ...groups[pulseIndex].items],
  }
  const insertAt = Math.min(cerealIndex, pulseIndex)
  const remaining = groups.filter((_, i) => i !== cerealIndex && i !== pulseIndex)
  remaining.splice(insertAt, 0, combined)
  return remaining
}

/**
 * `region` scopes the dish_combinations lookup (a combination row with a
 * non-null region only matches that region; a null-region row matches
 * everywhere). `archetypeName` is null for the large majority of meals
 * today (only South Indian breakfast has archetypes seeded) — this
 * function degrades to the dish_combinations path, then to no-op, exactly
 * as designed for that gap.
 */
export function combineDishGroups(
  groups: ComposedGroup[],
  archetypeName: string | null,
  archetypeDishFamilyIdsByExchangeType: Partial<Record<ExchangeCode, string[]>>,
  combinations: DishCombination[],
  region: string
): ComposedGroup[] {
  const cerealIndex = findCerealGroupIndex(groups)
  const pulseIndex = findPulseGroupIndex(groups)
  if (cerealIndex === -1 || pulseIndex === -1) return groups

  const cerealFamilyId = groups[cerealIndex].items[0].dishFamilyId
  const pulseFamilyId = groups[pulseIndex].items[0].dishFamilyId

  if (archetypeName) {
    const archetypeCerealFamilies = archetypeDishFamilyIdsByExchangeType.cereal ?? []
    const archetypePulseFamilies = archetypeDishFamilyIdsByExchangeType.pulse ?? []
    const cerealMatches = cerealFamilyId !== null && archetypeCerealFamilies.includes(cerealFamilyId)
    const pulseMatches = pulseFamilyId !== null && archetypePulseFamilies.includes(pulseFamilyId)
    if (cerealMatches && pulseMatches) {
      return mergeGroups(groups, cerealIndex, pulseIndex, archetypeName)
    }
  }

  if (!cerealFamilyId || !pulseFamilyId) return groups

  const match = combinations.find(
    (c) =>
      c.primaryDishFamilyId === cerealFamilyId &&
      c.secondaryDishFamilyId === pulseFamilyId &&
      (c.region === null || c.region === region)
  )
  if (!match) return groups

  return mergeGroups(groups, cerealIndex, pulseIndex, match.displayName)
}
