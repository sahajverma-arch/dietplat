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
  "for THAT DAY'S skeleton, for that slot and exchangeType — skeletonsByDay gives each of the 7 days its own " +
  "skeleton, and a slot's exchangeType counts (most often pulse) can differ slightly from one day to the next by " +
  "design; always use the count for the specific day you are filling, never assume every day matches day 0. You " +
  "may split a slot's count across more than one food of the same exchangeType if the rotation rules below ask " +
  "for it, but the total must match that day's skeleton exactly. " +
  "When a day's slot has an archetypeHint, treat it as the intended dish combination for that meal — prefer foods " +
  "whose role matches each named component, so the meal reads as that authentic dish rather than an arbitrary " +
  "combination. This is guidance, not a hard constraint — the exchange-count rules above always take priority."

export const ROTATION_RULES = [
  "Do not repeat the same cereal item in the same slot on consecutive days.",
  "The same pulse (dal) food must not be used on more than 2 days in the week.",
  "When a single day has fruit exchanges in more than one slot, use a different fruit in each slot.",
  "vegetable_a and vegetable_b: always use ONE food per slot, even at a high exchange count — real everyday " +
    "sabzi is single-vegetable, not an arbitrary mix, and a meal must never carry two separate cooked-vegetable " +
    "dishes. Never split a vegetable_a or vegetable_b slot across multiple foods of the same exchangeType.",
  "When a slot needs BOTH vegetable_a and vegetable_b, they may only appear together as ONE recognisable named " +
    "Indian dish (e.g. Aloo Gobi = potato + cauliflower, Aloo Baingan = potato + brinjal) — never an arbitrary " +
    "pairing. If the two foods you'd otherwise pick don't form such a dish, choose a vegetable_b food tagged " +
    "\"salad\" instead (it renders as a separate salad, not a competing sabzi).",
  "When a slot needs 2 or more fruit exchanges, split them across 2 different fruit foods instead of repeating one — " +
    "EXCEPT at mid_morning, which must always use exactly ONE fruit food for its full exchange count, however large; " +
    "never split mid_morning's fruit across two different foods.",
  "If a slot's cereal is a plain porridge (tagged \"no_cooking_fat\", e.g. Oats) rather than a fried/tempered dish " +
    "like a paratha, do not choose a cooking fat (tagged \"cooking_fat\" — ghee, oil) for that slot's fat exchange. " +
    "Pick a non-cooking-fat option instead (e.g. a nut like almonds or walnut) if one is in the eligible list.",
  "For breakfast specifically, if the cereal is NOT tagged \"no_cooking_fat\" (i.e. it's a regular cereal like a " +
    "paratha, not Oats), the fat exchange must be a cooking-fat food (tagged \"cooking_fat\") — never a nut. Nuts " +
    "are reserved for mid_morning; a nut at breakfast is only correct on the no_cooking_fat carve-out above.",
  "If a slot's meat exchange is a food tagged \"pairs_with_plain_paratha\" (Omelette), that slot's cereal exchange " +
    "must be a food tagged \"omelette_pairing_cereal\" (plain Paratha specifically — not Roti, Aloo/Gobi/Methi " +
    "Paratha, Oats, or any other cereal), only if such a food is in the eligible list for that slot.",
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
  /** Index 0-6 = dayIndex — see FoodSelectorInput.skeletonsByDay. Almost always identical day to day except for a small pulse-count difference on some days (daily-macro-jitter.ts). */
  skeletonsByDay: Record<string, UserPromptSlotItem[]>[]
  eligibleFoods: Record<string, Record<string, UserPromptFoodOption[]>>
  rotationRules: string[]
  previousWeekLastDay?: Record<string, { exchangeType: string; foodId: string; name: string }[]>
  /** Keyed by dayIndex (as a string, since JSON object keys always are), then slot. Only present for (day, slot) pairs where archetype-selector.ts actually chose an archetype. */
  archetypeHints?: Record<string, Record<string, UserPromptArchetypeHint>>
}

export function buildUserPromptPayload(input: FoodSelectorInput): UserPromptPayload {
  const skeletonsByDay: Record<string, UserPromptSlotItem[]>[] = input.skeletonsByDay.map((skeleton) => {
    const daySkeleton: Record<string, UserPromptSlotItem[]> = {}
    for (const [slot, items] of Object.entries(skeleton)) {
      daySkeleton[slot] = items.map((item) => ({ exchangeType: item.exchangeType, count: item.count }))
    }
    return daySkeleton
  })

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
    skeletonsByDay,
    eligibleFoods,
    rotationRules,
    previousWeekLastDay,
    archetypeHints,
  }
}

export function buildUserPrompt(input: FoodSelectorInput): string {
  return JSON.stringify(buildUserPromptPayload(input))
}
