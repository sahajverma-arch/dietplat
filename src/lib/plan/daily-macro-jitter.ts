/**
 * Introduces small, bounded day-to-day variety into an otherwise identical
 * weekly exchange skeleton — a direct dietitian request: real clients don't
 * eat mathematically identical macros every day, and a plan that does reads
 * as artificial. The weekly AVERAGE must still land exactly on the
 * prescribed target (still "THE ONE RULE THAT MATTERS" — nothing here lets a
 * number drift from deterministic exchange arithmetic), while individual
 * days wobble within a confirmed ~5-7g total protein spread across the week
 * (not per-day; the gap between the best and worst day).
 *
 * Scoped to `pulse` only, not fat or any other exchange type:
 * - `milk_cow`/`milk_skim`/`meat`/`meat_lean` are documented elsewhere
 *   (exchange-solver.ts, meal-distributor.ts) as indivisible and/or
 *   dietitian-mandated fixed floors — milk_cow always exactly 1 exchange,
 *   meat/meat_lean driven by anchorVariantTiers()'s tiered floor logic for
 *   non_vegetarian/eggetarian. A fractional day-to-day nudge on any of these
 *   would violate those invariants and could flip which tier "fits" for a
 *   given day, changing far more than intended on a wobble day.
 * - `fat` has a universal FAT_EXCHANGE_FLOOR (2, every diet type) with the
 *   same floor-collision risk as pulse's own floor, for a macro the
 *   dietitian didn't give numeric requirements for.
 * - `pulse` is the one macro-bearing exchange type that's genuinely
 *   continuous/freely divisible with no fixed floor outside VEGAN_PULSE_FLOOR
 *   (see exchange-solver.ts), and carries 7g protein per exchange — a ±0.5
 *   exchange delta is exactly ±3.5g protein, a 7g total spread across the
 *   week when 3 days go up and 3 go down. It also carries 17g carbs per
 *   exchange, so carbs and kcal wobble along with protein for free — this is
 *   why the mechanism is scoped to pulse alone rather than needing a second,
 *   separate jitter for "all macros should be allowed to move a little."
 */

import type { DietType } from "./exchange-solver"
import { VEGAN_PULSE_FLOOR } from "./exchange-solver"

const JITTER_DAYS = 7
const JITTER_DELTA = 0.5
// 3 up, 3 down, 1 flat — sums to exactly 0, so the week's average pulse
// count (and therefore average protein) is mathematically identical to the
// base single-week solve, which solveExchanges() already validated within
// tolerance. Which physical days get which sign is decided by stableHash
// below, not this fixed slot order.
const PATTERN: readonly number[] = [1, 1, 1, -1, -1, -1, 0]

function stableHash(...parts: string[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Fisher-Yates shuffle, seeded by a running stableHash so it's deterministic per seed. */
function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = stableHash(seed, String(i)) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Returns 7 deltas (multiples of JITTER_DELTA) to add to the base solved
 * `pulse` exchange count for days 0-6 of a week. Always sums to exactly 0.
 *
 * Degrades to all-zero (today's flat behavior) when the base count is too
 * low to safely subtract JITTER_DELTA without breaching the diet type's
 * pulse floor — the same graceful-degradation pattern used elsewhere in this
 * codebase (e.g. food-selector-fallback.ts's salad-restriction fallback)
 * rather than forcing an unsafe jitter or an asymmetric, non-zero-sum one.
 */
export function computeDailyPulseJitter(basePulseCount: number, dietType: DietType, seed: string): number[] {
  const floor = dietType === "vegan" ? VEGAN_PULSE_FLOOR : 0
  if (basePulseCount - JITTER_DELTA < floor) {
    return new Array(JITTER_DAYS).fill(0)
  }

  const shuffled = seededShuffle(PATTERN, seed)
  return shuffled.map((sign) => sign * JITTER_DELTA)
}
