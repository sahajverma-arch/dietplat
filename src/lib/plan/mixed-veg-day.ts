/**
 * Deterministic per-day gate: "is today the ONE day this week allowed to
 * show a generic multi-vegetable 'Mixed Vegetable {word}' dish" — see the
 * conversation this accompanies. Shared between food-selector-fallback.ts
 * (gates whether 2 arbitrary vegetable_a foods combine at SELECTION time)
 * and vegetable-dish-naming.ts (gates whether an uncurated vegetable_a +
 * vegetable_b pairing renders merged or split apart at DISPLAY time) — both
 * need the exact same answer for a given rotationDay, or a plan could
 * select a mixed vegetable_a pair on one day while the display layer
 * independently decides a DIFFERENT day is the "allowed" one, defeating the
 * whole point (both problems were real and reported — see git history).
 *
 * Picks exactly ONE day per 7-day week block, not an independent 1-in-7
 * coin flip per day: hashing each rotationDay on its own can and did
 * collide — 7 independent draws landing on residue 0 is not the same as
 * "exactly one of the 7 is selected", and in practice produced 3+
 * mixed-veg days in a single real week before this fix. Instead, the WEEK
 * itself picks which of its 7 days is the mixed one (stableHash on the
 * week block), then only that day matches — guaranteeing exactly 1 of 7.
 * rotationDay is always a multiple-of-7-aligned window in practice (day
 * index 0-6 plus dayIndexOffset = (weekNumber - 1) * 7 — see route.ts's
 * loadPreviousWeekSeed and plan-view-model.ts's callers), keeping every
 * week's window inside one block, while the specific weekday still varies
 * week to week since the hash input changes with the block.
 */
const MIXED_VEG_DAY_FREQUENCY = 7

function stableHash(...parts: string[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

export function isMixedVegDay(rotationDay: number): boolean {
  const weekBlock = Math.floor(rotationDay / MIXED_VEG_DAY_FREQUENCY)
  const dayWithinWeek = rotationDay % MIXED_VEG_DAY_FREQUENCY
  const mixedDayWithinWeek = stableHash("mixed_veg_day", String(weekBlock)) % MIXED_VEG_DAY_FREQUENCY
  return dayWithinWeek === mixedDayWithinWeek
}
