/**
 * Turns a food Selection into priced diet-plan rows: gram quantities per
 * item, and achieved macros per day recomputed from exchange counts ×
 * Table 4.1 — never from the LLM. Every food within an exchange type
 * carries identical macros by construction, so a selection's per-day
 * exchange totals always equal the skeleton's (already-solved) totals;
 * assertWithinTolerance() re-checks that as a defensive guard against a
 * validation bug upstream, not a new source of variance.
 */

import type { Food } from "@/db/schema"
import { sumExchanges, ZERO_COUNTS, type AchievedMacros, type ExchangeCode, type ExchangeCounts } from "./table-4-1"
import { ACCEPTANCE_FRACTION } from "./exchange-solver"
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

/** Throws PricedSelectionDeviationError if any day exceeds ACCEPTANCE_FRACTION on kcal/protein/fat/carbs. Returns the per-day deviations otherwise. */
export function assertWithinTolerance(priced: PricedSelection, dailyTarget: WeekTargets): DayDeviation[] {
  const deviations = priced.days.map((day) => ({
    dayIndex: day.dayIndex,
    kcal: Math.abs(day.achieved.kcal - dailyTarget.kcal) / dailyTarget.kcal,
    proteinG: Math.abs(day.achieved.proteinG - dailyTarget.proteinG) / dailyTarget.proteinG,
    fatG: Math.abs(day.achieved.fatG - dailyTarget.fatG) / dailyTarget.fatG,
    carbsG: Math.abs(day.achieved.carbsG - dailyTarget.carbsG) / dailyTarget.carbsG,
  }))

  const offending = deviations.filter(
    (d) => d.kcal >= ACCEPTANCE_FRACTION || d.proteinG >= ACCEPTANCE_FRACTION || d.fatG >= ACCEPTANCE_FRACTION || d.carbsG >= ACCEPTANCE_FRACTION
  )
  if (offending.length > 0) {
    throw new PricedSelectionDeviationError(offending)
  }

  return deviations
}
