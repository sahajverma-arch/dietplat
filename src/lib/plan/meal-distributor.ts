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

    const allowedTemplates = sortedTemplates.filter((t) => t.allowedExchangeTypes.includes(exchangeType))
    if (allowedTemplates.length === 0) {
      throw new Error(
        `${totalCount} ${exchangeType} exchange(s) have nowhere to go — no meal slot allows this exchange type.`
      )
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
