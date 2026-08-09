/**
 * Prompt construction — the ONLY place text gets sent to the LLM. The model
 * is given exchange slots and a pre-filtered food list; it is never shown a
 * calorie or macro target and never asked to compute anything. See
 * CLAUDE.md "THE ONE RULE THAT MATTERS".
 */

import type { FoodSelectorInput } from "./food-selector-types"

export const SYSTEM_PROMPT =
  "You select foods for an Indian diet plan. You are given exchange slots and a list of allowed foods with IDs. " +
  "Return ONLY JSON. Never invent a food. Never output a food ID not in the provided list. " +
  "Never output quantities, calories or macros — quantities are fixed by the exchange system. " +
  "For every slot, the sum of exchangeCount you output per exchangeType must exactly equal the count given to you " +
  "for that slot and exchangeType — you may split that count across more than one food of the same exchangeType " +
  "if the rotation rules below ask for it, but the total must match exactly. " +
  "When a day's slot has an archetypeHint, treat it as the intended dish combination for that meal — prefer foods " +
  "whose role matches each named component, so the meal reads as that authentic dish rather than an arbitrary " +
  "combination. This is guidance, not a hard constraint — the exchange-count rules above always take priority."

export const ROTATION_RULES = [
  "Do not repeat the same cereal item in the same slot on consecutive days.",
  "The same pulse (dal) food must not be used on more than 2 days in the week.",
  "When a single day has fruit exchanges in more than one slot, use a different fruit in each slot.",
  "When a slot needs 2 or more vegetable_a exchanges, split them across 2 different vegetable_a foods " +
    "instead of repeating one — this applies especially at dinner.",
  "When a slot needs 2 or more fruit exchanges, split them across 2 different fruit foods instead of repeating one.",
  "Prefer variety across the 7 days over repeating the same food — rotate through the eligible list.",
]

interface UserPromptSlotItem {
  exchangeType: string
  count: number
}

interface UserPromptFoodOption {
  id: string
  name: string
  tags: string[]
}

interface UserPromptArchetypeHint {
  name: string
  components: { role: string; exchangeType: string }[]
}

interface UserPromptPayload {
  region: string
  dietType: string
  mealCount: number
  days: number
  skeleton: Record<string, UserPromptSlotItem[]>
  eligibleFoods: Record<string, Record<string, UserPromptFoodOption[]>>
  rotationRules: string[]
  previousWeekLastDay?: Record<string, { exchangeType: string; foodId: string; name: string }[]>
  /** Keyed by dayIndex (as a string, since JSON object keys always are), then slot. Only present for (day, slot) pairs where archetype-selector.ts actually chose an archetype. */
  archetypeHints?: Record<string, Record<string, UserPromptArchetypeHint>>
}

export function buildUserPromptPayload(input: FoodSelectorInput): UserPromptPayload {
  const skeleton: Record<string, UserPromptSlotItem[]> = {}
  for (const [slot, items] of Object.entries(input.skeleton)) {
    skeleton[slot] = items.map((item) => ({ exchangeType: item.exchangeType, count: item.count }))
  }

  const eligibleFoods: Record<string, Record<string, UserPromptFoodOption[]>> = {}
  for (const [slot, byExchangeType] of Object.entries(input.eligibleFoodsBySlot)) {
    eligibleFoods[slot] = {}
    for (const [exchangeType, foods] of Object.entries(byExchangeType)) {
      eligibleFoods[slot][exchangeType] = (foods ?? []).map((f) => ({
        id: f.id,
        name: f.nameEn,
        tags: f.tags,
      }))
    }
  }

  const rotationRules = [...ROTATION_RULES]
  let previousWeekLastDay: UserPromptPayload["previousWeekLastDay"]
  if (input.previousWeekLastDay) {
    previousWeekLastDay = {}
    for (const [slot, items] of Object.entries(input.previousWeekLastDay)) {
      previousWeekLastDay[slot] = items.map((i) => ({ exchangeType: i.exchangeType, foodId: i.foodId, name: i.nameEn }))
    }
    rotationRules.push(
      "previousWeekLastDay shows what the client ate in each slot on the final day of last week — day 0 of this " +
        "week must not repeat any of those foods in the same slot and exchangeType, so the two weeks don't read as a hard cut."
    )
  }

  let archetypeHints: UserPromptPayload["archetypeHints"]
  if (input.archetypeAssignmentsByDay) {
    for (const [dayIndex, assignments] of input.archetypeAssignmentsByDay.entries()) {
      for (const assignment of assignments) {
        if (!assignment.archetypeId || !assignment.archetypeName) continue
        archetypeHints ??= {}
        archetypeHints[String(dayIndex)] ??= {}
        archetypeHints[String(dayIndex)][assignment.slot] = {
          name: assignment.archetypeName,
          components: assignment.components.map((c) => ({ role: c.role, exchangeType: c.exchangeType })),
        }
      }
    }
  }

  return {
    region: input.region,
    dietType: input.dietType,
    mealCount: input.mealCount,
    days: 7,
    skeleton,
    eligibleFoods,
    rotationRules,
    previousWeekLastDay,
    archetypeHints,
  }
}

export function buildUserPrompt(input: FoodSelectorInput): string {
  return JSON.stringify(buildUserPromptPayload(input))
}
