/**
 * Deterministic season derivation for the seasonal eligibility filter — pure
 * arithmetic, no I/O, same discipline as the counselling engine and
 * exchange-solver.ts. Season is a function of week_start and region, since
 * the Indian calendar shifts north to south.
 *
 * Only one calendar exists today (NORTH_CALENDAR), grounded in the North
 * Indian / Punjab seasonal cycle. Every region currently falls back to it —
 * a real SOUTH_CALENDAR / WEST_CALENDAR / EAST_CALENDAR per region cluster
 * needs its own grounding (real monsoon-onset dates differ meaningfully by
 * coast) rather than being guessed here. This is a known, deliberate
 * limitation, not an oversight — see CLAUDE.md "The exchange system".
 */
import { type Season } from "@/lib/foods/vocab"

const NORTH_CALENDAR: Record<number, Season> = {
  0: "winter",
  1: "winter",
  2: "summer",
  3: "summer",
  4: "summer",
  5: "summer",
  6: "monsoon",
  7: "monsoon",
  8: "monsoon",
  9: "monsoon",
  10: "winter",
  11: "winter",
}

export function seasonFor(weekStartISO: string, _region: string): Season {
  const month = new Date(weekStartISO + "T00:00:00Z").getUTCMonth()
  return NORTH_CALENDAR[month]
}
