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
// See the cerealFloor comment at its one call site (cereal's residual
// computation) for why this only applies conditionally, not unconditionally
// like the other floors above.
const CEREAL_FLOOR_WHEN_WANTED = 4
// Exported so daily-macro-jitter.ts's floor guard uses the same number this
// solver actually searches from, instead of a second hardcoded copy that
// could silently drift out of sync with it.
export const VEGAN_PULSE_FLOOR = 2
/**
 * Exchanges above the floor, in 0.5 steps — was 8 (effectively no ceiling: 8
 * exchanges = 240 g raw dal/day) until a real generated plan showed why
 * that's a bug, not flexibility: once MILK_COW_CAP went to 0 and milk_skim
 * got fixed at a small MILK_SKIM_CAP (see their own comments), pulse became
 * the search's cheapest remaining lever to close a protein gap that milk
 * used to help cover — and the cost search took it, landing on 7.5-8.5
 * exchanges/day (225-255 g raw dal) split into two ~120 g single-meal
 * servings, roughly 4x a realistic bowl of dal (Table 4.1's own 30 g/exchange
 * IS meant to be one real katori — the bug was never the per-exchange
 * weight, only how many of them the search was allowed to stack).
 * A ceiling of 4 (6 for vegan, via its higher VEGAN_PULSE_FLOOR) keeps a
 * day's pulse within 1-2 realistic exchanges per meal across lunch+dinner.
 * This has a second, non-obvious benefit: it was ALSO silently starving
 * cereal's own residual computation, since pulse's 17 g carbs/exchange was
 * covering so much of the carbs target that cereal's leftover share
 * shrank below 1 full exchange (20 g — less than one roti). Capping pulse
 * frees that carb budget back up for cereal automatically; no separate fix
 * needed there.
 *
 * The ceiling is 6, not 4: 4 was the first value tried, and broke a real
 * golden client (Sneha, TEST-003) whose eggetarian tier 1 (a single egg,
 * meat=1 — see anchorVariantTiers()'s own comment) specifically trades
 * lower egg-protein for more pulse, and genuinely needs 6 exchanges to land
 * within tolerance on her exact numbers — confirmed by instrumenting every
 * tier's own search individually, not by guessing. 6 exchanges/day split
 * ~evenly across lunch+dinner is ~90 g raw dal/meal — a generous single
 * bowl, not the 120-135 g/meal (4-4.5 exchanges EACH, ~240 g/day total) the
 * original uncapped search produced, but real rather than the idealized 4.
 * This is also NOT the same knob as the widened attempt below reaching for
 * this value: the widened attempt's own vegetable_a/vegetable_b/fruit floor
 * increases turned out to make Sneha's case WORSE (more veg carbs on top of
 * an already-tight carb budget), so the fix had to be the realistic ceiling
 * itself, not an escape hatch one layer up.
 */
const PULSE_SEARCH_SPAN = 6
const WIDEN_STEP = 2 // extra exchanges added to each floor on retry
/**
 * Last-resort fruit-only widening, tried in attemptTier() after both the
 * base and widened (vegetable_a/vegetable_b/fruit together) attempts have
 * already failed — confirmed necessary on a real client (Rohan, week 1): a
 * large protein-ramp shortfall gets backfilled entirely into carbs by
 * weekTargets() (see roadmap.ts), producing a target with unusually low
 * protein (55 g) alongside unusually high carbs (383 g) for that kcal/fat
 * level. Table 4.1's mandatory non-vegan floors (milk_skim fixed at 1,
 * meat_lean/meat's diet-type floor, vegetable_a's floor/cap) already commit
 * ~17-21 g of protein before any carbs are filled, and cereal — the main
 * remaining carb source once vegetable_a/vegetable_b/pulse hit their normal
 * ceilings — carries its own protein (2 g per 15 g carbs), so a large carb
 * target unavoidably drags protein up with it UNLESS something else absorbs
 * those carbs for free. fruit is that lever: 10 g carbs/exchange at 0 g
 * protein, versus vegetable_b's 7 g carbs/2 g protein — so this tier
 * deliberately holds vegetable_a/vegetable_b at the BASE (unwidened) floors
 * from attemptTier() and widens ONLY fruit's ceiling, which the ordinary
 * widened attempt never does on its own (it raises vegetable_b's floor
 * alongside fruit's, which adds protein back and defeats the point here).
 * Confirmed against Rohan's real target: fruit=9 (within this tier's
 * ceiling) is what actually clears all four macros; the ordinary widened
 * attempt's ceiling of 7 falls just short.
 */
const FRUIT_RESCUE_WIDEN = 6
/**
 * A dietitian directive, not a macro constraint: curd is fixed at exactly 1
 * milk_skim exchange (320 g — Curd's own servingRawG, close enough to the
 * dietitian's "about 300 g/day" figure) every day, for every non-vegan diet
 * type — never searched as a range. This was tried first as a floor + a wide
 * search span (mirroring how the old milk_cow flexibility worked), but that
 * let the cost search land on 3 milk_skim exchanges (960 g curd) for a real
 * client target — the opposite of "only about 300 g," which is a cap, not a
 * minimum. Fixed, not searched, is also the exact same anchor style
 * MILK_COW_CAP itself used before this change (a single dietitian-set
 * number, with the solver's existing fat/pulse/cereal residual flexibility
 * absorbing whatever macro difference is left) — curd inherits that same
 * anchor role milk used to hold, rather than becoming a second free variable.
 */
const MILK_SKIM_CAP = 1

/**
 * A dietitian directive, not a macro constraint: milk_cow defaults to 0
 * exchanges for every diet type (vegan already excluded it entirely; this
 * extends the same "no milk by default" floor to vegetarian/eggetarian/
 * non_vegetarian/jain too) — curd (milk_skim) is the default dairy exchange
 * now, milk only when a dietitian specifically overrides it for a client.
 * milk_skim (below) picks up ALL of the day's dairy macro that used to be
 * split between a fixed 1 milk_cow exchange (250 ml) and milk_skim covering
 * the excess — MILK_SKIM_SEARCH_SPAN is widened accordingly. This was
 * previously fixed at 2 for vegetarian/eggetarian and searched [1, 2] for
 * non_vegetarian, then capped at exactly 1 (never 2) because meal-
 * distributor.ts's INDIVISIBLE_TYPES has to put the WHOLE day's count in one
 * slot, and 2 produced an unservable 500 ml glass of milk in one sitting —
 * that indivisibility problem doesn't apply to curd, which is naturally
 * split across lunch and dinner instead.
 */
const MILK_COW_CAP = 0

/**
 * Absolute last resort: a real golden target (Sneha, TEST-003 — ~73 g
 * protein at a tight ~48 g fat ceiling) turned out to be infeasible on curd
 * alone. milk_skim carries 0 g fat vs milk_cow's 10 g, and none of pulse/
 * vegetables/cereal carry fat either — for a low-fat-ceiling eggetarian
 * target, losing that 10 g pushes the fat-exchange residual just past the
 * coarse 2.5 g grid's reach no matter how every other exchange is chosen
 * (confirmed: every no-milk tier, both floor widths, still misses by ~1 g).
 * anchorVariantTiers() appends one rescue tier per diet type (except vegan,
 * which excludes dairy for an unrelated reason) with milk_cow restored to
 * this value, tried only after every curd-only tier has already failed —
 * so a client only ever gets milk when curd genuinely cannot hit the target,
 * never as a default or a preference.
 */
const MILK_COW_RESCUE = 1

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
 * vegetarian/jain: a dietitian directive — paneer (Table 4.1's "meat"
 * exchange, same slot Egg occupies) should be a REAL, mandatory protein
 * source here, not just permitted; the anchor previously fixed meat=0
 * unconditionally, which meant no "meat"-type food (paneer included) could
 * EVER appear for these two diet types regardless of what table41_foods.json
 * tagged as eligible. Egg/Omelette/Egg curry/Egg bhurji's own dietTypes
 * exclude vegetarian/jain (see table41_foods.json) — so eligible-foods.ts's
 * existing diet_types filter naturally narrows this floor down to Paneer
 * (+ Paneer Tikka for vegetarian only; jain has no onion-garlic-free tikka
 * variant) with no new food tagging required. Tier 0/1 mirror eggetarian's
 * own 2-then-1 pattern exactly (40g raw/exchange, same "too small to plate
 * alone at 1" reasoning). Unlike eggetarian, tier 2 keeps a meat:0 escape
 * hatch: paneer isn't the defining feature of "vegetarian" the way egg is of
 * "eggetarian" (a vegetarian target is still clinically complete without
 * it), and Paneer/Paneer Tikka are the ONLY vegetarian-eligible "meat" foods
 * — a dairy-allergic client or one who dislikes paneer would otherwise have
 * zero eligible foods for a tier that hard-requires it, failing generation
 * outright instead of falling back gracefully.
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
function curdOnlyTiers(dietType: DietType): AnchorVariant[][] {
  switch (dietType) {
    case "vegetarian":
    case "jain":
      return [
        [{ milkCow: MILK_COW_CAP, meat: 2, meatLean: 0 }],
        [{ milkCow: MILK_COW_CAP, meat: 1, meatLean: 0 }],
        [{ milkCow: MILK_COW_CAP, meat: 0, meatLean: 0 }],
      ]
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

/**
 * curdOnlyTiers()'s list, plus one milk-rescue tier appended per curd-only
 * tier (identical meat/meatLean options, milk_cow restored to
 * MILK_COW_RESCUE instead of MILK_COW_CAP) — see MILK_COW_RESCUE's own
 * comment for why this exists. Vegan is excluded entirely: its milk_cow=0
 * is "no dairy at all" for an unrelated reason, not "curd instead of milk,"
 * so there is nothing to rescue with milk there. Every curd-only tier is
 * tried, in its normal preference order, before ANY milk-rescue tier —
 * milk is the last resort across the board, never preferred over a looser
 * curd-only egg/meat combination.
 */
function anchorVariantTiers(dietType: DietType): AnchorVariant[][] {
  const curdOnly = curdOnlyTiers(dietType)
  if (dietType === "vegan") return curdOnly

  const milkRescue = curdOnly.map((tier) => tier.map((variant) => ({ ...variant, milkCow: MILK_COW_RESCUE })))
  return [...curdOnly, ...milkRescue]
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
  /**
   * Ceiling for milk_skim's own small search band above MILK_SKIM_CAP — {1}
   * (a single value, no band at all) on attemptTier()'s base attempt, so
   * curd is exactly "about 300 g/day" whenever that alone clears tolerance;
   * MILK_SKIM_CAP + WIDEN_STEP on the widened attempt, the same coarse-grid
   * rescue latitude vegetable_b/fruit already get there. Needed because a
   * single hard-fixed milk_skim value (tried first) narrowly failed
   * tolerance on a real golden target (Sneha, TEST-003) purely from Table
   * 4.1's coarse fat-exchange grid — the same class of near-miss
   * neighboringHalfSteps() already exists to rescue for fat/cereal, just one
   * layer up (attemptTier()'s two-attempt fallback) since milk_skim isn't
   * solved as a direct residual the way fat/cereal are.
   */
  milkSkimCeiling: number
}

function search(input: SolverInput, floors: SearchFloors, variants: AnchorVariant[]) {
  let best: { counts: ExchangeCounts; achieved: AchievedMacros; cost: number } | null = null

  const pulseFloor = input.dietType === "vegan" ? VEGAN_PULSE_FLOOR : 0
  const milkSkimCeiling = input.dietType === "vegan" ? 0 : floors.milkSkimCeiling
  const vegetableAUpper = floors.vegetableACapped ? floors.vegetableA : floors.vegetableA + WIDEN_STEP

  // Vegan excludes every dairy exchange, milk_skim included — see
  // MILK_COW_CAP's own comment for why milk_skim is used at all.
  const milkSkimFloor = input.dietType === "vegan" ? 0 : MILK_SKIM_CAP

  for (const variant of variants) {
    for (let pulse = pulseFloor; pulse <= pulseFloor + PULSE_SEARCH_SPAN; pulse += 0.5) {
      for (let milkSkim = milkSkimFloor; milkSkim <= milkSkimCeiling; milkSkim += 0.5) {
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
              const rawCereal = (input.carbsG - carbsBeforeCereal) / TABLE_4_1.cereal.carbsG
              // A flat CEREAL_FLOOR was tried and rejected: some real targets
              // (Sneha, TEST-003) genuinely need zero cereal — carbsBeforeCereal
              // already meets the target, so rawCereal is at or below 0 — and
              // forcing cereal onto that target pushed her carbs 26% over.
              // But a target that DOES want some cereal (rawCereal > 0) still
              // needs a realistic floor once it's wanted at all: cereal split
              // across breakfast/lunch/evening/dinner (4 slots) rounding down
              // to 0.5 exchanges (10 g total for the WHOLE DAY) is what left a
              // real generated plan's evening slot completely empty — evening
              // only allows cereal (fruit moved to mid_morning-only earlier
              // this session), so "cereal consolidates elsewhere" there means
              // "evening gets nothing to eat," not just a smaller portion.
              // CEREAL_FLOOR_WHEN_WANTED(4) is picked to give a realistic ~1
              // exchange to each of the 4 cereal-eligible slots on an even
              // split — the conditional (only when genuinely wanted) is what
              // lets this coexist with Sneha's genuine zero-cereal case.
              const cerealFloor = rawCereal > 0 ? CEREAL_FLOOR_WHEN_WANTED : 0
              const cerealCandidates = neighboringHalfSteps(rawCereal, cerealFloor)

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
    // {1} only — curd stays exactly "about 300 g/day" whenever that alone clears tolerance.
    milkSkimCeiling: MILK_SKIM_CAP,
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
    // Coarse-grid rescue latitude, same reasoning as vegetable_b/fruit's own
    // widening above — see SearchFloors.milkSkimCeiling's own comment.
    milkSkimCeiling: MILK_SKIM_CAP + WIDEN_STEP,
  }
  const second = search(input, widenedFloors, variants)
  const secondDeviation = deviationOf(second.achieved, input)
  if (withinAcceptance(secondDeviation)) {
    return { result: second, deviation: secondDeviation, ok: true }
  }

  // See FRUIT_RESCUE_WIDEN's own comment — vegetable_a/vegetable_b stay
  // pinned at the BASE floors (not `widenedFloors`'s raised ones) since
  // widening them works against this specific low-protein/high-carb
  // scenario; only fruit's ceiling is pushed further out. milk_skim also
  // stays pinned at the single-value MILK_SKIM_CAP, not the coarse-grid
  // rescue band `widenedFloors` uses — curd is a hard dietitian directive
  // ("never searched as a range" — see MILK_SKIM_CAP's own comment), not a
  // lever this tier is allowed to reach for.
  const fruitRescueFloors: SearchFloors = {
    vegetableA: vegetableAFloor,
    vegetableB: VEGETABLE_B_FLOOR,
    fruit: FRUIT_FLOOR + FRUIT_RESCUE_WIDEN,
    vegetableACapped: isNonVegetarian,
    milkSkimCeiling: MILK_SKIM_CAP,
  }
  const third = search(input, fruitRescueFloors, variants)
  const thirdDeviation = deviationOf(third.achieved, input)
  if (withinAcceptance(thirdDeviation)) {
    return { result: third, deviation: thirdDeviation, ok: true }
  }

  const candidates = [
    { result: first, deviation: firstDeviation },
    { result: second, deviation: secondDeviation },
    { result: third, deviation: thirdDeviation },
  ]
  const better = candidates.reduce((a, b) => (b.result.cost <= a.result.cost ? b : a))
  return { result: better.result, deviation: better.deviation, ok: false }
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
