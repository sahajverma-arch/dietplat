/**
 * The exchange solver — the piece that guarantees the plan hits the
 * roadmap numbers. Pure arithmetic, no AI, no I/O: same inputs, same
 * output, every time. No LLM involved anywhere in this file.
 *
 * Verified against a real generated plan (Deepak Sharma, maintenance,
 * target 2618 kcal / P73 / C411 / F76): decoding his actual week-1 skeleton
 * exchange-by-exchange (18 cereal, 2 milk_cow, 2 pulse, 3 vegetable_a,
 * 2 vegetable_b, 6 fruit, 11 fat) reproduces his delivered 2617/73/413/75
 * exactly against Table 4.1's constants — see exchange-solver.test.ts. That
 * test's milk_cow assertion has since moved to 1, not 2: MILK_COW_CAP (see
 * below) now caps every diet type at 1 milk_cow exchange regardless of what
 * the real plan used, a later dietitian directive about realistic single-
 * sitting servings — the solver still lands within tolerance for this same
 * target via its existing fat/pulse/fruit flexibility.
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
const MILK_SKIM_SEARCH_SPAN = 3 // exchanges above 0, in 0.5 steps — see milk_skim's own comment below

/**
 * A dietitian directive, not a macro constraint: a single sitting never
 * carries more than 1 milk_cow exchange (250 ml — Table 4.1's own standard
 * serving), for every diet type. Previously fixed at 2 for
 * vegetarian/eggetarian and searched [1, 2] for non_vegetarian — meal-
 * distributor.ts's INDIVISIBLE_TYPES then had to put the WHOLE day's count
 * in one slot, producing an unservable 500 ml glass of milk whenever 2 was
 * chosen. milk_skim (below) is what absorbs whatever dairy macro this cap
 * leaves uncovered, plated as Raita/Chaach at lunch instead of a second
 * glass of milk.
 */
const MILK_COW_CAP = 1

/**
 * Non-vegetarian-specific: meat_lean now always anchors to dinner (see
 * meal-distributor.ts), which structurally excludes vegetable_a from ever
 * landing there — so the day's ENTIRE vegetable_a allocation always lands
 * at the one remaining meal (lunch). The textbook 4-exchange floor (400 g)
 * doesn't fit one realistic ~200 g dish there, and a dietitian confirmed
 * neither "serve it as one oversized dish" nor "split it across 2 dishes in
 * the same meal" are acceptable. Capping non-vegetarian's vegetable_a at
 * exactly 2 exchanges (200 g, fits one dish) and letting cereal absorb the
 * resulting carb difference — already how the solver works, since cereal is
 * solved as a residual against the exact carbs target below — was confirmed
 * as clinically fine for this population specifically. Every other diet
 * type still splits vegetable_a naturally across lunch AND dinner and keeps
 * the full 4-exchange floor (widened up to 8 across the two search
 * attempts in attemptTier()) unchanged.
 */
const NON_VEGETARIAN_VEGETABLE_A_CAP = 2

interface AnchorVariant {
  milkCow: number
  meat: number
  meatLean: number
}

/**
 * Ordered, most- to least-preferred lists of anchor variants — solveExchanges()
 * tries each tier's whole search in order and returns the first that clears
 * tolerance, only moving to the next (looser) tier when a stricter one can't
 * fit the target's macros. Diet types with nothing to loosen just return one
 * tier.
 *
 * eggetarian: tier 0 requires 2 eggs (one "meat" exchange is one whole egg,
 * ~40g raw, Table 4.1 — too small a serving to plate alone); tier 1 allows a
 * single egg, an escape hatch for the rare target (Sneha TEST-003, Aadi
 * TEST-004) where 2 eggs' extra fat/protein can't fit the 1.5% tolerance.
 *
 * non_vegetarian: tier 0 requires 2 meat_lean exchanges (real chicken/fish,
 * 35g/exchange, ~70g) — a client tagged non-vegetarian rather than
 * eggetarian expects actual meat, not just eggs, so real meat is the
 * default floor here rather than "meat OR meat_lean, whichever's cheaper".
 * Eggs are still allowed alongside it (0 or 2), never required. Tier 1 drops
 * the meat_lean=2 requirement back to "some egg or lean-meat/fish, any
 * amount 0-2, never both zero" (today's old floor) for a target real meat
 * can't fit. Tier 2 is the last-resort escape hatch allowing a lone 1 egg,
 * same reasoning as eggetarian's tier 1.
 */
function anchorVariantTiers(dietType: DietType): AnchorVariant[][] {
  switch (dietType) {
    case "vegetarian":
    case "jain":
      return [[{ milkCow: MILK_COW_CAP, meat: 0, meatLean: 0 }]]
    case "eggetarian":
      // No meat:0 variant at either tier — an egg-free option would let the
      // cost search quietly drop the egg exchange whenever a
      // milk/pulse-only combination fit the macro target equally well or
      // better, leaving an eggetarian client's plan with zero eggs despite
      // the diet type.
      return [
        [{ milkCow: MILK_COW_CAP, meat: 2, meatLean: 0 }],
        [{ milkCow: MILK_COW_CAP, meat: 1, meatLean: 0 }],
      ]
    case "vegan":
      return [[{ milkCow: 0, meat: 0, meatLean: 0 }]]
    case "non_vegetarian": {
      const buildTier = (meatOptions: number[], meatLeanOptions: number[]) => {
        const variants: AnchorVariant[] = []
        for (const meatLean of meatLeanOptions) {
          for (const meat of meatOptions) {
            // Excluding the all-zero combo guarantees at least one egg or
            // lean-meat/fish exchange survives the cost search, instead of
            // the plan silently reducing to a vegetarian-equivalent
            // skeleton.
            if (meat === 0 && meatLean === 0) continue
            variants.push({ milkCow: MILK_COW_CAP, meat, meatLean })
          }
        }
        return variants
      }
      return [
        buildTier([0, 2], [2]), // real meat required, egg optional
        buildTier([0, 2], [0, 1, 2]), // real meat optional, egg still 0-or-2
        buildTier([0, 1, 2], [0, 1, 2]), // last resort: a lone 1 egg allowed
      ]
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
  /** True for non_vegetarian — see NON_VEGETARIAN_VEGETABLE_A_CAP. Fixes vegetableA at exactly `vegetableA`, skipping the usual +WIDEN_STEP search above it. */
  vegetableACapped?: boolean
}

function search(input: SolverInput, floors: SearchFloors, variants: AnchorVariant[]) {
  let best: { counts: ExchangeCounts; achieved: AchievedMacros; cost: number } | null = null

  const pulseFloor = input.dietType === "vegan" ? VEGAN_PULSE_FLOOR : 0
  // Vegan excludes every dairy exchange, milk_skim included — see
  // MILK_COW_CAP's own comment for why milk_skim is searched at all.
  const milkSkimMax = input.dietType === "vegan" ? 0 : MILK_SKIM_SEARCH_SPAN
  const vegetableAUpper = floors.vegetableACapped ? floors.vegetableA : floors.vegetableA + WIDEN_STEP

  for (const variant of variants) {
    for (let pulse = pulseFloor; pulse <= pulseFloor + PULSE_SEARCH_SPAN; pulse += 0.5) {
      for (let milkSkim = 0; milkSkim <= milkSkimMax; milkSkim += 0.5) {
        for (let vegA = floors.vegetableA; vegA <= vegetableAUpper; vegA++) {
          for (let vegB = floors.vegetableB; vegB <= floors.vegetableB + WIDEN_STEP; vegB++) {
            for (let fruit = floors.fruit; fruit <= floors.fruit + WIDEN_STEP; fruit++) {
              const preFat: ExchangeCounts = {
                ...ZERO_COUNTS,
                milk_cow: variant.milkCow,
                milk_skim: milkSkim,
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
  }

  return best as NonNullable<typeof best>
}

/**
 * Runs the base-floor / widened-floor pair of searches for one variant
 * tier, exactly the two attempts solveExchanges() always made before the
 * tier dimension existed. `ok` reports whether either attempt cleared
 * tolerance; `result` is always the better (lower-cost) of the two either
 * way, for the caller to fall back to if every tier misses.
 */
function attemptTier(
  input: SolverInput,
  variants: AnchorVariant[]
): { result: { counts: ExchangeCounts; achieved: AchievedMacros; cost: number }; deviation: Deviation; ok: boolean } {
  const isNonVegetarian = input.dietType === "non_vegetarian"
  const vegetableAFloor = isNonVegetarian ? NON_VEGETARIAN_VEGETABLE_A_CAP : VEGETABLE_A_FLOOR

  const baseFloors: SearchFloors = {
    vegetableA: vegetableAFloor,
    vegetableB: VEGETABLE_B_FLOOR,
    fruit: FRUIT_FLOOR,
    vegetableACapped: isNonVegetarian,
  }
  const first = search(input, baseFloors, variants)
  const firstDeviation = deviationOf(first.achieved, input)
  if (withinAcceptance(firstDeviation)) {
    return { result: first, deviation: firstDeviation, ok: true }
  }

  const widenedFloors: SearchFloors = {
    // Non-vegetarian's vegetable_a stays pinned to the cap even on the
    // widened attempt — there's still only one meal that can ever carry it.
    vegetableA: isNonVegetarian ? vegetableAFloor : VEGETABLE_A_FLOOR + WIDEN_STEP,
    vegetableB: VEGETABLE_B_FLOOR + WIDEN_STEP,
    fruit: FRUIT_FLOOR + WIDEN_STEP,
    vegetableACapped: isNonVegetarian,
  }
  const second = search(input, widenedFloors, variants)
  const secondDeviation = deviationOf(second.achieved, input)
  if (withinAcceptance(secondDeviation)) {
    return { result: second, deviation: secondDeviation, ok: true }
  }

  const better = second.cost <= first.cost ? second : first
  const betterDeviation = second.cost <= first.cost ? secondDeviation : firstDeviation
  return { result: better, deviation: betterDeviation, ok: false }
}

/**
 * Known limitation, not a bug: a target with an unusually high
 * protein-to-fat ratio can be infeasible for a diet type whose anchor
 * variants (see anchorVariantTiers()) all carry more fat-per-protein-gram
 * than the target wants — e.g. an eggetarian target needing ~73 g protein at a
 * tight ~48 g fat ceiling, where both available variants (milk+1 egg,
 * milk+2 eggs) overshoot fat once pulse is pushed far enough to hit
 * protein. Confirmed by exhaustive search (pulse 0-12, full
 * vegetable/fruit range) finding zero combinations within 1.5% on all four
 * macros for that case — this is a real ceiling of the current fixed
 * anchors, not something widening search ranges further would fix. ok:false
 * + best is the correct, honest result; the caller must not silently accept
 * it (see quantity.ts).
 *
 * Tiered variant preference: tries each of anchorVariantTiers()'s tiers in
 * order (strictest/most-realistic first — e.g. non_vegetarian's "2 real
 * meat_lean exchanges required" before its "any egg/meat_lean combo"
 * fallback) and returns the first whose search clears tolerance on either
 * floor width. Diet types with only one tier (vegetarian/jain/vegan) just
 * run that single tier. If every tier misses, returns the lowest-cost
 * result across all of them.
 */
export function solveExchanges(input: SolverInput): SolverResult {
  const attempts = anchorVariantTiers(input.dietType).map((variants) => attemptTier(input, variants))

  const successful = attempts.find((a) => a.ok)
  if (successful) {
    return { ok: true, exchangeCounts: successful.result.counts, achieved: successful.result.achieved, deviation: successful.deviation }
  }

  const best = attempts.reduce((a, b) => (b.result.cost <= a.result.cost ? b : a))
  return {
    ok: false,
    best: { exchangeCounts: best.result.counts, achieved: best.result.achieved, deviation: best.deviation },
    reason:
      "No exchange combination cleared 1.5% deviation on all four macros, even after widening vegetable and fruit ranges and, for egg/meat-containing diet types, relaxing through every fallback tier.",
  }
}
