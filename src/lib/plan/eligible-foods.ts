/**
 * Pre-filters foods BEFORE the prompt — the model never sees an ineligible
 * food and never decides eligibility itself. Every rule here runs in code.
 */

import type { Food } from "@/db/schema"
import type { ExchangeCode } from "./table-4-1"

export interface EligibilityCriteria {
  region: string
  dietType: string
  clientAllergens: string[]
  clientDislikes: string[]
  /** e.g. ["hypothyroid", "pcos"] — see MEDICAL_TAG_RULES below. */
  medicalTags?: string[]
}

/**
 * Medical condition → food-tag exclusion/preference rule. Exclusions win
 * outright; preference rules are applied as a sort bias later (by the
 * selector), not a hard filter, since "prefer low_gi" shouldn't zero out
 * every cereal for a PCOS client.
 */
const MEDICAL_EXCLUDE_TAGS: Record<string, string[]> = {
  hypothyroid: ["raw_soy"],
}

export class NoEligibleFoodsError extends Error {
  constructor(
    public readonly exchangeType: ExchangeCode,
    public readonly slot: string,
    public readonly failedFilter: string
  ) {
    super(`No eligible foods for ${exchangeType} at ${slot} — the "${failedFilter}" filter removed every candidate.`)
    this.name = "NoEligibleFoodsError"
  }
}

interface FilterStep {
  name: string
  keep: (food: Food) => boolean
}

function buildSteps(criteria: EligibilityCriteria): FilterStep[] {
  const dislikesLower = new Set(criteria.clientDislikes.map((d) => d.toLowerCase()))
  const excludedMedicalTags = new Set((criteria.medicalTags ?? []).flatMap((tag) => MEDICAL_EXCLUDE_TAGS[tag] ?? []))

  return [
    { name: "is_active", keep: (f) => f.isActive },
    { name: "regions", keep: (f) => f.regions.includes(criteria.region) || f.regions.includes("generic") },
    { name: "diet_types", keep: (f) => f.dietTypes.includes(criteria.dietType) },
    {
      name: "allergens",
      keep: (f) => !f.allergens.some((a) => criteria.clientAllergens.includes(a)),
    },
    { name: "dislikes", keep: (f) => !dislikesLower.has(f.nameEn.toLowerCase()) },
    {
      name: "medical_tags",
      keep: (f) => excludedMedicalTags.size === 0 || !f.tags.some((t) => excludedMedicalTags.has(t)),
    },
  ]
}

/** Applies every step in order — this is the actual eligibility filter used to build the prompt payload. */
export function filterEligibleFoods(allFoods: Food[], criteria: EligibilityCriteria): Food[] {
  const steps = buildSteps(criteria)
  return steps.reduce((remaining, step) => remaining.filter(step.keep), allFoods)
}

/**
 * Groups already-filtered foods by (slot, exchangeType) for a skeleton. If
 * any slot/exchangeType the skeleton actually needs has zero candidates,
 * replays the filter pipeline against just that exchange type to name
 * which stage caused it, and throws — the caller must never let the model
 * invent a food to fill the hole.
 */
export function eligibleFoodsForSkeleton(
  allFoods: Food[],
  criteria: EligibilityCriteria,
  neededSlotsByExchangeType: Map<ExchangeCode, Set<string>>
): Record<string, Partial<Record<ExchangeCode, Food[]>>> {
  const eligible = filterEligibleFoods(allFoods, criteria)
  const result: Record<string, Partial<Record<ExchangeCode, Food[]>>> = {}

  for (const [exchangeType, slots] of neededSlotsByExchangeType) {
    const ofType = eligible.filter((f) => f.exchangeType === exchangeType)
    for (const slot of slots) {
      const forSlot = ofType.filter((f) => f.mealSlots.includes(slot))
      if (forSlot.length === 0) {
        throw diagnoseEmptySet(allFoods, criteria, exchangeType, slot)
      }
      result[slot] ??= {}
      result[slot][exchangeType] = forSlot
    }
  }

  return result
}

function diagnoseEmptySet(
  allFoods: Food[],
  criteria: EligibilityCriteria,
  exchangeType: ExchangeCode,
  slot: string
): NoEligibleFoodsError {
  let remaining = allFoods.filter((f) => f.exchangeType === exchangeType)
  const steps = [
    ...buildSteps(criteria),
    { name: "meal_slots", keep: (f: Food) => f.mealSlots.includes(slot) },
  ]
  for (const step of steps) {
    remaining = remaining.filter(step.keep)
    if (remaining.length === 0) {
      return new NoEligibleFoodsError(exchangeType, slot, step.name)
    }
  }
  // Shouldn't happen — the caller only calls this when the real filter
  // pipeline (which uses the same steps) already produced an empty set.
  return new NoEligibleFoodsError(exchangeType, slot, "unknown")
}
