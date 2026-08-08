/**
 * The exchange solver — the piece that guarantees the plan hits the
 * roadmap numbers. Pure arithmetic, no AI, no I/O: same inputs, same
 * output, every time. No LLM involved anywhere in this file.
 *
 * Verified against a real generated plan (Deepak Sharma, maintenance,
 * target 2618 kcal / P73 / C411 / F76): decoding his actual week-1 skeleton
 * exchange-by-exchange (18 cereal, 2 milk_cow, 2 pulse, 3 vegetable_a,
 * 2 vegetable_b, 6 fruit, 11 fat) reproduces his delivered 2617/73/413/75
 * exactly against Table 4.1's constants — see exchange-solver.test.ts.
 */

import { sumExchanges, TABLE_4_1, ZERO_COUNTS, type AchievedMacros, type ExchangeCounts } from "./table-4-1"

export type DietType = "vegetarian" | "eggetarian" | "non_vegetarian" | "vegan" | "jain"

export interface SolverInput {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fibreG: number
  dietType: DietType
  /** Off by default — a maintenance/weight-loss plan carries no sugar exchange. */
  sugarEnabled?: boolean
}

export interface Deviation {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export interface SolverSuccess {
  ok: true
  exchangeCounts: ExchangeCounts
  achieved: AchievedMacros
  deviation: Deviation
}

export interface SolverFailure {
  ok: false
  best: { exchangeCounts: ExchangeCounts; achieved: AchievedMacros; deviation: Deviation }
  reason: string
}

export type SolverResult = SolverSuccess | SolverFailure

// <1.5% deviation on kcal, protein, fat, carbs. Exported so quantity.ts can
// re-check the same tolerance after food-selector picks real foods — exchange
// counts don't change at that point (every food of a given exchange type
// carries identical Table 4.1 macros), so this is a defensive re-check, not a
// second source of drift.
export const ACCEPTANCE_FRACTION = 0.015
const FAT_EXCHANGE_FLOOR = 2
const VEGETABLE_A_FLOOR = 4
const VEGETABLE_B_FLOOR = 2
const FRUIT_FLOOR = 3
const VEGAN_PULSE_FLOOR = 2
const PULSE_SEARCH_SPAN = 8 // exchanges above the floor, in 0.5 steps
const WIDEN_STEP = 2 // extra exchanges added to each floor on retry

interface AnchorVariant {
  milkCow: number
  meat: number
  meatLean: number
}

function anchorVariants(dietType: DietType): AnchorVariant[] {
  switch (dietType) {
    case "vegetarian":
    case "jain":
      return [{ milkCow: 2, meat: 0, meatLean: 0 }]
    case "eggetarian":
      return [
        { milkCow: 2, meat: 0, meatLean: 0 },
        { milkCow: 2, meat: 1, meatLean: 0 },
      ]
    case "vegan":
      return [{ milkCow: 0, meat: 0, meatLean: 0 }]
    case "non_vegetarian": {
      const variants: AnchorVariant[] = []
      for (const milkCow of [1, 2]) {
        for (const meatLean of [0, 1, 2]) {
          for (const meat of [0, 1]) {
            variants.push({ milkCow, meat, meatLean })
          }
        }
      }
      return variants
    }
  }
}

function deviationOf(achieved: AchievedMacros, target: SolverInput): Deviation {
  return {
    kcal: Math.abs(achieved.kcal - target.kcal) / target.kcal,
    proteinG: Math.abs(achieved.proteinG - target.proteinG) / target.proteinG,
    fatG: Math.abs(achieved.fatG - target.fatG) / target.fatG,
    carbsG: Math.abs(achieved.carbsG - target.carbsG) / target.carbsG,
  }
}

function withinAcceptance(deviation: Deviation): boolean {
  return (
    deviation.kcal < ACCEPTANCE_FRACTION &&
    deviation.proteinG < ACCEPTANCE_FRACTION &&
    deviation.fatG < ACCEPTANCE_FRACTION &&
    deviation.carbsG < ACCEPTANCE_FRACTION
  )
}

function cost(achieved: AchievedMacros, target: SolverInput): number {
  return (
    4 * Math.abs(achieved.proteinG - target.proteinG) +
    2 * Math.abs(achieved.fatG - target.fatG) +
    1 * Math.abs(achieved.carbsG - target.carbsG) +
    0.02 * Math.abs(achieved.kcal - target.kcal)
  )
}

/**
 * Both half-exchange steps neighbouring `raw`, floored at `floor`. Fat and
 * cereal are solved directly (division + rounding), not searched — a
 * single "nearest" rounding can land the achieved macro just outside 1.5%
 * tolerance even when the OTHER neighbour would have cleared it (Table 4.1
 * grids are coarse: 2.5 g/fat-step, 7.5 g carbs/cereal-step). Trying both
 * and letting cost() pick catches those near-misses without searching a
 * wider space.
 */
function neighboringHalfSteps(raw: number, floor: number): number[] {
  const lower = Math.max(floor, Math.floor(raw * 2) / 2)
  const upper = Math.max(floor, Math.ceil(raw * 2) / 2)
  return lower === upper ? [lower] : [lower, upper]
}

interface SearchFloors {
  vegetableA: number
  vegetableB: number
  fruit: number
}

function search(input: SolverInput, floors: SearchFloors) {
  let best: { counts: ExchangeCounts; achieved: AchievedMacros; cost: number } | null = null

  const pulseFloor = input.dietType === "vegan" ? VEGAN_PULSE_FLOOR : 0

  for (const variant of anchorVariants(input.dietType)) {
    for (let pulse = pulseFloor; pulse <= pulseFloor + PULSE_SEARCH_SPAN; pulse += 0.5) {
      for (let vegA = floors.vegetableA; vegA <= floors.vegetableA + WIDEN_STEP; vegA++) {
        for (let vegB = floors.vegetableB; vegB <= floors.vegetableB + WIDEN_STEP; vegB++) {
          for (let fruit = floors.fruit; fruit <= floors.fruit + WIDEN_STEP; fruit++) {
            const preFat: ExchangeCounts = {
              ...ZERO_COUNTS,
              milk_cow: variant.milkCow,
              meat: variant.meat,
              meat_lean: variant.meatLean,
              pulse,
              vegetable_a: vegA,
              vegetable_b: vegB,
              fruit,
            }
            const preFatMacros = sumExchanges(preFat)

            const fatCandidates = neighboringHalfSteps(
              (input.fatG - preFatMacros.fatG) / TABLE_4_1.fat.fatG,
              FAT_EXCHANGE_FLOOR
            )

            const carbsBeforeCereal = preFatMacros.carbsG // fat exchange carries no carbs
            const cerealCandidates = neighboringHalfSteps((input.carbsG - carbsBeforeCereal) / TABLE_4_1.cereal.carbsG, 0)

            for (const fatExchanges of fatCandidates) {
              for (const cerealExchanges of cerealCandidates) {
                const counts: ExchangeCounts = {
                  ...preFat,
                  fat: fatExchanges,
                  cereal: cerealExchanges,
                  sugar: input.sugarEnabled ? 1 : 0,
                }
                const achieved = sumExchanges(counts)
                const c = cost(achieved, input)

                if (!best || c < best.cost) {
                  best = { counts, achieved, cost: c }
                }
              }
            }
          }
        }
      }
    }
  }

  return best as NonNullable<typeof best>
}

/**
 * Known limitation, not a bug: a target with an unusually high
 * protein-to-fat ratio can be infeasible for a diet type whose anchor
 * variants (see anchorVariants()) all carry more fat-per-protein-gram than
 * the target wants — e.g. an eggetarian target needing ~73 g protein at a
 * tight ~48 g fat ceiling, where both available variants (milk+0 egg,
 * milk+1 egg) overshoot fat once pulse is pushed far enough to hit protein.
 * Confirmed by exhaustive search (pulse 0-12, full vegetable/fruit range)
 * finding zero combinations within 1.5% on all four macros for that case —
 * this is a real ceiling of the current fixed anchors, not something
 * widening search ranges further would fix. ok:false + best is the correct,
 * honest result; the caller must not silently accept it (see quantity.ts).
 */
export function solveExchanges(input: SolverInput): SolverResult {
  const baseFloors: SearchFloors = {
    vegetableA: VEGETABLE_A_FLOOR,
    vegetableB: VEGETABLE_B_FLOOR,
    fruit: FRUIT_FLOOR,
  }

  const first = search(input, baseFloors)
  const firstDeviation = deviationOf(first.achieved, input)
  if (withinAcceptance(firstDeviation)) {
    return { ok: true, exchangeCounts: first.counts, achieved: first.achieved, deviation: firstDeviation }
  }

  const widenedFloors: SearchFloors = {
    vegetableA: VEGETABLE_A_FLOOR + WIDEN_STEP,
    vegetableB: VEGETABLE_B_FLOOR + WIDEN_STEP,
    fruit: FRUIT_FLOOR + WIDEN_STEP,
  }
  const second = search(input, widenedFloors)
  const secondDeviation = deviationOf(second.achieved, input)
  if (withinAcceptance(secondDeviation)) {
    return { ok: true, exchangeCounts: second.counts, achieved: second.achieved, deviation: secondDeviation }
  }

  const better = second.cost <= first.cost ? second : first
  const betterDeviation = second.cost <= first.cost ? secondDeviation : firstDeviation
  return {
    ok: false,
    best: { exchangeCounts: better.counts, achieved: better.achieved, deviation: betterDeviation },
    reason: "No exchange combination cleared 1.5% deviation on all four macros, even after widening vegetable and fruit ranges once.",
  }
}
