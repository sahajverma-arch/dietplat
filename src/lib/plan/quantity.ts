/**
 * Turns a food Selection into priced diet-plan rows: gram quantities per
 * item, and achieved macros per day recomputed from exchange counts ×
 * Table 4.1 — never from the LLM. Every food within an exchange type
 * carries identical macros by construction, so a selection's per-day
 * exchange totals always equal that day's own skeleton's (already-solved)
 * totals; assertWithinTolerance() re-checks that per day as a defensive
 * guard against a validation bug upstream, not a new source of variance.
 * Days are no longer necessarily identical to each other (see
 * daily-macro-jitter.ts) — assertWeeklyAverageWithinTolerance() is the
 * function that actually enforces the prescribed target, across the week's
 * average rather than any single day.
 */

import type { Food } from "@/db/schema"
import { sumExchanges, ZERO_COUNTS, type AchievedMacros, type ExchangeCode, type ExchangeCounts } from "./table-4-1"
import { ACCEPTANCE_FRACTION, type Deviation } from "./exchange-solver"
import type { Selection, SelectedDay } from "./food-selector-types"
import type { WeekTargets } from "@/lib/counselling/roadmap"

export interface PricedItem {
  foodId: string
  exchangeType: ExchangeCode
  exchangeCount: number
  /** Null for fruit — Table 4.1 defines fruit's raw amount as variable; householdMeasure carries the real portion. */
  servingRawG: number | null
  householdMeasure: string | null
}

export interface PricedMeal {
  slot: string
  items: PricedItem[]
}

export interface PricedDay {
  dayIndex: number
  meals: PricedMeal[]
  achieved: AchievedMacros
}

export interface PricedSelection {
  days: PricedDay[]
}

export class UnknownFoodError extends Error {
  constructor(public readonly foodId: string) {
    super(`priceSelection: food ${foodId} not found — was it deactivated after selection ran?`)
    this.name = "UnknownFoodError"
  }
}

export class ExchangeTypeMismatchError extends Error {
  constructor(
    public readonly foodId: string,
    public readonly foodExchangeType: string,
    public readonly selectedExchangeType: string
  ) {
    super(
      `priceSelection: food ${foodId} is exchange type ${foodExchangeType}, but the selection labelled it ${selectedExchangeType}.`
    )
    this.name = "ExchangeTypeMismatchError"
  }
}

export function priceSelection(selection: Selection, foodsById: Map<string, Food>): PricedSelection {
  return { days: selection.days.map((day) => priceDay(day, foodsById)) }
}

function priceDay(day: SelectedDay, foodsById: Map<string, Food>): PricedDay {
  const counts: ExchangeCounts = { ...ZERO_COUNTS }

  const meals: PricedMeal[] = day.meals.map((meal) => ({
    slot: meal.slot,
    items: meal.items.map((item) => {
      const food = foodsById.get(item.foodId)
      if (!food) throw new UnknownFoodError(item.foodId)
      if (food.exchangeType !== item.exchangeType) {
        throw new ExchangeTypeMismatchError(item.foodId, food.exchangeType, item.exchangeType)
      }

      counts[item.exchangeType] += item.exchangeCount

      const servingRawG =
        food.servingRawG === null ? null : (item.exchangeCount / food.exchangeUnits) * food.servingRawG

      return {
        foodId: item.foodId,
        exchangeType: item.exchangeType,
        exchangeCount: item.exchangeCount,
        servingRawG,
        householdMeasure: food.householdMeasure,
      }
    }),
  }))

  return { dayIndex: day.dayIndex, meals, achieved: sumExchanges(counts) }
}

export interface DayDeviation {
  dayIndex: number
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export class PricedSelectionDeviationError extends Error {
  constructor(public readonly deviations: DayDeviation[]) {
    const worst = deviations.reduce((a, b) => (Math.max(b.kcal, b.proteinG, b.fatG, b.carbsG) > Math.max(a.kcal, a.proteinG, a.fatG, a.carbsG) ? b : a))
    super(
      `Priced selection deviates from the week's daily target by more than ${ACCEPTANCE_FRACTION * 100}% on day ${worst.dayIndex} ` +
        `(kcal ${(worst.kcal * 100).toFixed(2)}%, protein ${(worst.proteinG * 100).toFixed(2)}%, fat ${(worst.fatG * 100).toFixed(2)}%, carbs ${(worst.carbsG * 100).toFixed(2)}%). ` +
        `This should be impossible if the skeleton and selection validation are correct — do not silently accept, investigate the upstream bug.`
    )
    this.name = "PricedSelectionDeviationError"
  }
}

/**
 * Throws PricedSelectionDeviationError if any day exceeds ACCEPTANCE_FRACTION
 * against ITS OWN expected macros — not the flat weekly target. Since
 * daily-macro-jitter.ts intentionally makes some days' exchange counts (and
 * therefore achieved macros) differ from the weekly average by design, each
 * day must be checked against what its OWN jittered exchange counts imply
 * (expectedByDay[day.dayIndex], computed via sumExchanges() before food
 * selection ever runs) — a real wobble day would fail every time if checked
 * against the flat target instead. This stays the same "defensive, should be
 * impossible to fail" guard it always was; assertWeeklyAverageWithinTolerance
 * below is what actually enforces the target the dietitian is promised.
 */
export function assertWithinTolerance(priced: PricedSelection, expectedByDay: AchievedMacros[]): DayDeviation[] {
  const deviations = priced.days.map((day) => {
    const expected = expectedByDay[day.dayIndex]
    return {
      dayIndex: day.dayIndex,
      kcal: Math.abs(day.achieved.kcal - expected.kcal) / expected.kcal,
      proteinG: Math.abs(day.achieved.proteinG - expected.proteinG) / expected.proteinG,
      fatG: Math.abs(day.achieved.fatG - expected.fatG) / expected.fatG,
      carbsG: Math.abs(day.achieved.carbsG - expected.carbsG) / expected.carbsG,
    }
  })

  const offending = deviations.filter(
    (d) => d.kcal >= ACCEPTANCE_FRACTION || d.proteinG >= ACCEPTANCE_FRACTION || d.fatG >= ACCEPTANCE_FRACTION || d.carbsG >= ACCEPTANCE_FRACTION
  )
  if (offending.length > 0) {
    throw new PricedSelectionDeviationError(offending)
  }

  return deviations
}

export class WeeklyAverageDeviationError extends Error {
  constructor(public readonly deviation: Deviation) {
    super(
      `Priced selection's WEEKLY AVERAGE deviates from the prescribed daily target by more than ${ACCEPTANCE_FRACTION * 100}% ` +
        `(kcal ${(deviation.kcal * 100).toFixed(2)}%, protein ${(deviation.proteinG * 100).toFixed(2)}%, fat ${(deviation.fatG * 100).toFixed(2)}%, carbs ${(deviation.carbsG * 100).toFixed(2)}%). ` +
        `This should be impossible — daily-macro-jitter.ts's deltas are zero-sum by construction, so the weekly average should exactly equal ` +
        `the single base solve's already-validated achieved macros. Investigate the upstream bug, do not silently accept.`
    )
    this.name = "WeeklyAverageDeviationError"
  }
}

/**
 * The actual clinical guarantee: the MEAN of all 7 days' achieved macros
 * must be within tolerance of the true prescribed dailyTarget, even though
 * individual days now legitimately wobble around it. Because
 * daily-macro-jitter.ts's per-day deltas are exactly zero-sum, this holds
 * mathematically whenever the base weekly solve was already `ok` — a
 * defensive re-check, not a new source of risk.
 */
export function assertWeeklyAverageWithinTolerance(priced: PricedSelection, dailyTarget: WeekTargets): void {
  const n = priced.days.length
  const sum = priced.days.reduce(
    (acc, day) => ({
      kcal: acc.kcal + day.achieved.kcal,
      proteinG: acc.proteinG + day.achieved.proteinG,
      fatG: acc.fatG + day.achieved.fatG,
      carbsG: acc.carbsG + day.achieved.carbsG,
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  )

  const deviation: Deviation = {
    kcal: Math.abs(sum.kcal / n - dailyTarget.kcal) / dailyTarget.kcal,
    proteinG: Math.abs(sum.proteinG / n - dailyTarget.proteinG) / dailyTarget.proteinG,
    fatG: Math.abs(sum.fatG / n - dailyTarget.fatG) / dailyTarget.fatG,
    carbsG: Math.abs(sum.carbsG / n - dailyTarget.carbsG) / dailyTarget.carbsG,
  }

  if (
    deviation.kcal >= ACCEPTANCE_FRACTION ||
    deviation.proteinG >= ACCEPTANCE_FRACTION ||
    deviation.fatG >= ACCEPTANCE_FRACTION ||
    deviation.carbsG >= ACCEPTANCE_FRACTION
  ) {
    throw new WeeklyAverageDeviationError(deviation)
  }
}
