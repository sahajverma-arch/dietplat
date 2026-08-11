/**
 * Splits solved exchange counts across meal-template slots by kcal_share,
 * respecting each slot's allowed_exchange_types (no pulse at mid-morning,
 * no milk at lunch, etc.) — the SKELETON. Identical for all seven days;
 * only the foods filling each slot rotate later (Prompt 7). Pure
 * arithmetic, no AI, no I/O.
 */

import type { ExchangeCode, ExchangeCounts } from "./table-4-1"

export interface MealSlotTemplate {
  slot: string
  slotOrder: number
  kcalShare: number
  allowedExchangeTypes: ExchangeCode[]
}

export interface SkeletonItem {
  exchangeType: ExchangeCode
  count: number
}

export type Skeleton = Record<string, SkeletonItem[]>

/**
 * A whole egg or a whole chicken/fish serving isn't a continuously
 * divisible quantity the way rice, dal, or vegetables are — splitting the
 * day's 2 meat exchanges into "0.5 at breakfast + 1.5 at lunch" would put
 * two separate, oddly-sized Egg lines on the same day's plan instead of one
 * real serving. milk_cow/milk_skim get the same treatment for a different
 * reason: proportioning a single daily exchange (250 ml) across two meals
 * produces a "125 ml glass + 125 ml folded into evening chai" split that
 * doesn't match how milk is conventionally served in one sitting — see the
 * conversation this accompanies. The full day's count for these types goes
 * to a single slot instead of being proportioned across every allowed one.
 */
const INDIVISIBLE_TYPES = new Set<ExchangeCode>(["meat", "meat_lean", "milk_cow", "milk_skim"])

/**
 * meat_lean (chicken/fish) anchors to the LAST allowed slot (dinner) rather
 * than the first — a dietitian directive: real non-veg dishes always land
 * at dinner, never lunch, for a fixed, predictable structure rather than
 * the day-to-day rotation nonveg-slot-rotation.ts used to paper over (now
 * removed, since there's no longer anything to rotate). `meat` (a whole
 * egg) keeps the original first-allowed-slot behaviour — egg is still a
 * normal breakfast food and wasn't part of this directive.
 */
const LAST_SLOT_INDIVISIBLE_TYPES = new Set<ExchangeCode>(["meat_lean"])

/**
 * A meal built around a meat/egg exchange keeps its other exchange types to
 * cereal (roti/rice) and fat — no dal, no separate vegetable sabzi
 * alongside it, matching how a non-veg meal is conventionally plated (the
 * meat *is* the protein-and-side course, not an addition to a dal-and-sabzi
 * one). Only pulse/vegetable_a/vegetable_b are excluded; fat and cereal stay
 * unrestricted since a meat-based dish is still typically cooked in oil and
 * served with a staple. meat/meat_lean are always resolved first (see
 * ZERO_COUNTS's field order, which Object.keys(counts) follows), so by the
 * time these types are apportioned, `skeleton` already reflects where any
 * meat/meat_lean landed.
 */
const MEAT_CONFLICTING_TYPES = new Set<ExchangeCode>(["pulse", "vegetable_a", "vegetable_b"])

/**
 * Largest-remainder apportionment in half-exchange units, so every
 * exchange type's slot allocations sum back to exactly the solved total —
 * proportional rounding alone can drift by a fraction of an exchange.
 */
function apportion(totalHalfUnits: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight <= 0 || totalHalfUnits <= 0) return weights.map(() => 0)

  const raw = weights.map((w) => (w / totalWeight) * totalHalfUnits)
  const floors = raw.map(Math.floor)
  let remaining = totalHalfUnits - floors.reduce((a, b) => a + b, 0)

  const remainders = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floors]
  for (let k = 0; k < remainders.length && remaining > 0; k++, remaining--) {
    result[remainders[k].i] += 1
  }
  return result
}

export function distributeMeals(counts: ExchangeCounts, templates: MealSlotTemplate[]): Skeleton {
  const sortedTemplates = [...templates].sort((a, b) => a.slotOrder - b.slotOrder)
  const skeleton: Skeleton = Object.fromEntries(sortedTemplates.map((t) => [t.slot, [] as SkeletonItem[]]))

  for (const exchangeType of Object.keys(counts) as ExchangeCode[]) {
    const totalCount = counts[exchangeType]
    if (!totalCount) continue

    let allowedTemplates = sortedTemplates.filter((t) => t.allowedExchangeTypes.includes(exchangeType))
    if (allowedTemplates.length === 0) {
      throw new Error(
        `${totalCount} ${exchangeType} exchange(s) have nowhere to go — no meal slot allows this exchange type.`
      )
    }

    if (MEAT_CONFLICTING_TYPES.has(exchangeType)) {
      const slotsWithMeat = new Set(
        Object.entries(skeleton)
          .filter(([, items]) => items.some((i) => i.exchangeType === "meat" || i.exchangeType === "meat_lean"))
          .map(([slot]) => slot)
      )
      const withoutMeatSlots = allowedTemplates.filter((t) => !slotsWithMeat.has(t.slot))
      // Only apply the exclusion if a meat-free slot actually remains —
      // never let it produce a slot with nowhere to put a real exchange
      // that must go somewhere.
      if (withoutMeatSlots.length > 0) allowedTemplates = withoutMeatSlots
    }

    if (INDIVISIBLE_TYPES.has(exchangeType)) {
      // Earliest allowed slot by slot_order for most indivisible types
      // (egg at breakfast, milk at breakfast) — meat_lean is the one
      // exception, anchored to the LAST allowed slot (dinner) instead. See
      // LAST_SLOT_INDIVISIBLE_TYPES's own comment.
      const anchorSlot = LAST_SLOT_INDIVISIBLE_TYPES.has(exchangeType)
        ? allowedTemplates[allowedTemplates.length - 1].slot
        : allowedTemplates[0].slot
      skeleton[anchorSlot].push({ exchangeType, count: totalCount })
      continue
    }

    const totalHalfUnits = Math.round(totalCount * 2)
    const shares = apportion(
      totalHalfUnits,
      allowedTemplates.map((t) => t.kcalShare)
    )

    allowedTemplates.forEach((t, i) => {
      const count = shares[i] / 2
      if (count > 0) {
        skeleton[t.slot].push({ exchangeType, count })
      }
    })
  }

  return skeleton
}
