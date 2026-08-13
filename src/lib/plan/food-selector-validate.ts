/**
 * Post-validation of the LLM's raw output against the skeleton and eligible
 * food set — this is the actual enforcement of "never invent a food, never
 * drift from the exchange counts". A model that passes JSON-shape (Zod)
 * validation can still fail every rule here; only output that survives both
 * gets used.
 */

import type { ExchangeCode } from "./table-4-1"
import type { FoodSelectorInput, Selection } from "./food-selector-types"
import type { LlmSelection } from "./food-selector-schema"
import type { ArchetypeAssignment } from "./archetype-selector"

const FLOAT_TOLERANCE = 1e-6

export function toSelection(llm: LlmSelection): Selection {
  return {
    days: llm.days.map((day) => ({
      dayIndex: day.dayIndex,
      meals: day.meals.map((meal) => ({
        slot: meal.slot,
        items: meal.items.map((item) => ({
          foodId: item.foodId,
          exchangeType: item.exchangeType as ExchangeCode,
          exchangeCount: item.exchangeCount,
        })),
      })),
    })),
  }
}

export function validateSelection(selection: Selection, input: FoodSelectorInput): string[] {
  const errors: string[] = []

  // Slot names never differ day to day — every skeletonsByDay entry comes
  // from the same templates, only pulse's exchange count varies (see
  // daily-macro-jitter.ts) — so day 0's slot set is representative of all 7.
  const knownSlots = new Set(Object.keys(input.skeletonsByDay[0]))
  const dayIndexesSeen = new Set<number>()

  for (const day of selection.days) {
    if (dayIndexesSeen.has(day.dayIndex)) {
      errors.push(`dayIndex ${day.dayIndex} appears more than once.`)
    }
    dayIndexesSeen.add(day.dayIndex)

    const slotsSeenThisDay = new Set<string>()
    for (const meal of day.meals) {
      if (!knownSlots.has(meal.slot)) {
        errors.push(`day ${day.dayIndex}: unknown slot "${meal.slot}" — not in the skeleton.`)
        continue
      }
      if (slotsSeenThisDay.has(meal.slot)) {
        errors.push(`day ${day.dayIndex}: slot "${meal.slot}" appears more than once.`)
      }
      slotsSeenThisDay.add(meal.slot)

      const expectedItems = input.skeletonsByDay[day.dayIndex][meal.slot]
      const expectedByType = new Map(expectedItems.map((i) => [i.exchangeType, i.count]))
      const actualByType = new Map<ExchangeCode, number>()

      const slotBuckets = input.eligibleFoodsBySlot[meal.slot] ?? {}

      for (const item of meal.items) {
        // Look up by claimed exchangeType first (the common case), but fall
        // back to scanning every bucket for this slot — eligibleFoodsBySlot
        // groups foods by their OWN exchangeType, so a food that exists
        // under a different bucket than claimed is a mislabel, not a food
        // that's absent from the eligible set entirely. Distinguishing the
        // two gives a more actionable error.
        let food = slotBuckets[item.exchangeType]?.find((f) => f.id === item.foodId)
        if (!food) {
          for (const bucket of Object.values(slotBuckets)) {
            food = bucket?.find((f) => f.id === item.foodId)
            if (food) break
          }
        }

        if (!food) {
          errors.push(
            `day ${day.dayIndex} ${meal.slot}: food ${item.foodId} is not in the eligible set for ${item.exchangeType}.`
          )
          continue
        }
        if (food.exchangeType !== item.exchangeType) {
          errors.push(
            `day ${day.dayIndex} ${meal.slot}: food ${item.foodId} is exchange type ${food.exchangeType}, not ${item.exchangeType} as labelled.`
          )
        }
        actualByType.set(item.exchangeType, (actualByType.get(item.exchangeType) ?? 0) + item.exchangeCount)
      }

      for (const [exchangeType, expectedCount] of expectedByType) {
        const actualCount = actualByType.get(exchangeType) ?? 0
        if (Math.abs(actualCount - expectedCount) > FLOAT_TOLERANCE) {
          errors.push(
            `day ${day.dayIndex} ${meal.slot}: ${exchangeType} total is ${actualCount}, skeleton requires exactly ${expectedCount}.`
          )
        }
      }
      for (const exchangeType of actualByType.keys()) {
        if (!expectedByType.has(exchangeType)) {
          errors.push(`day ${day.dayIndex} ${meal.slot}: ${exchangeType} was not requested by the skeleton at all.`)
        }
      }
    }

    for (const slot of knownSlots) {
      if (!slotsSeenThisDay.has(slot)) {
        errors.push(`day ${day.dayIndex}: skeleton slot "${slot}" is missing entirely.`)
      }
    }
  }

  for (let expected = 0; expected < 7; expected++) {
    if (!dayIndexesSeen.has(expected)) {
      errors.push(`dayIndex ${expected} is missing from the response — all 7 days (0-6) are required.`)
    }
  }

  errors.push(...validateRotationRules(selection))

  return errors
}

export interface ArchetypeAdherenceEntry {
  dayIndex: number
  slot: string
  archetypeId: string
  archetypeCode: string
  adherence: "full" | "partial" | "none"
  matchedComponents: number
  totalComponents: number
}

/**
 * Informational only — NEVER added to validateSelection()'s errors array
 * and never blocks or retries a generation attempt. Checks whether the
 * foods actually selected for an archetype-assigned slot carry the
 * dish_family its required components asked for. A miss here means the
 * LLM (or, in the per-component graceful-degrade edge case in
 * eligible-foods.ts, the fallback selector) picked a food outside the
 * intended dish family while still satisfying every hard exchange-count
 * rule above — a quality signal for observability (see
 * plan_generation_runs.validation_result), not a correctness one. Nutrition
 * validation (quantity.ts's assertWithinTolerance) is completely separate
 * and unaffected by anything in this function.
 */
export function checkArchetypeAdherence(
  selection: Selection,
  archetypeAssignmentsByDay: ArchetypeAssignment[][],
  input: FoodSelectorInput
): ArchetypeAdherenceEntry[] {
  const entries: ArchetypeAdherenceEntry[] = []

  for (const day of selection.days) {
    const dayArchetypes = archetypeAssignmentsByDay[day.dayIndex]
    if (!dayArchetypes) continue

    for (const meal of day.meals) {
      const assignment = dayArchetypes.find((a) => a.slot === meal.slot)
      if (!assignment || !assignment.archetypeId) continue

      const requiredComponents = assignment.components.filter((c) => c.isRequired)
      let matched = 0
      for (const component of requiredComponents) {
        const itemsOfType = meal.items.filter((i) => i.exchangeType === component.exchangeType)
        const slotBucket = input.eligibleFoodsBySlot[meal.slot]?.[component.exchangeType] ?? []
        const satisfied = itemsOfType.some((item) => {
          const food = slotBucket.find((f) => f.id === item.foodId)
          return !!food?.dishFamilyId && component.dishFamilyIds.includes(food.dishFamilyId)
        })
        if (satisfied) matched += 1
      }

      const total = requiredComponents.length
      const adherence: ArchetypeAdherenceEntry["adherence"] =
        total === 0 || matched === total ? "full" : matched > 0 ? "partial" : "none"

      entries.push({
        dayIndex: day.dayIndex,
        slot: meal.slot,
        archetypeId: assignment.archetypeId,
        archetypeCode: assignment.archetypeCode ?? "",
        adherence,
        matchedComponents: matched,
        totalComponents: total,
      })
    }
  }

  return entries
}

function validateRotationRules(selection: Selection): string[] {
  const errors: string[] = []
  const sortedDays = [...selection.days].sort((a, b) => a.dayIndex - b.dayIndex)

  // No cereal repeat in the same slot on consecutive days.
  const lastCerealBySlot = new Map<string, { dayIndex: number; foodId: string }>()
  for (const day of sortedDays) {
    for (const meal of day.meals) {
      const cerealItems = meal.items.filter((i) => i.exchangeType === "cereal")
      for (const item of cerealItems) {
        const last = lastCerealBySlot.get(meal.slot)
        if (last && last.dayIndex === day.dayIndex - 1 && last.foodId === item.foodId) {
          errors.push(`cereal food ${item.foodId} repeats in slot "${meal.slot}" on consecutive days ${last.dayIndex} and ${day.dayIndex}.`)
        }
        lastCerealBySlot.set(meal.slot, { dayIndex: day.dayIndex, foodId: item.foodId })
      }
    }
  }

  // Same pulse food on at most 2 days across the week.
  const pulseDaysByFood = new Map<string, Set<number>>()
  for (const day of sortedDays) {
    for (const meal of day.meals) {
      for (const item of meal.items.filter((i) => i.exchangeType === "pulse")) {
        const days = pulseDaysByFood.get(item.foodId) ?? new Set<number>()
        days.add(day.dayIndex)
        pulseDaysByFood.set(item.foodId, days)
      }
    }
  }
  for (const [foodId, days] of pulseDaysByFood) {
    if (days.size > 2) {
      errors.push(`pulse food ${foodId} is used on ${days.size} days — the limit is 2 per week.`)
    }
  }

  // Fruit varies across slots within a day.
  for (const day of sortedDays) {
    const fruitIdsThisDay: string[] = []
    for (const meal of day.meals) {
      for (const item of meal.items.filter((i) => i.exchangeType === "fruit")) {
        fruitIdsThisDay.push(item.foodId)
      }
    }
    const duplicates = fruitIdsThisDay.filter((id, i) => fruitIdsThisDay.indexOf(id) !== i)
    for (const dup of new Set(duplicates)) {
      errors.push(`day ${day.dayIndex}: fruit food ${dup} is repeated across slots on the same day.`)
    }
  }

  return errors
}
