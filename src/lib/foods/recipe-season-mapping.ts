/**
 * Normalizes the recipe CSV's real `Season` column — exactly 3 distinct
 * values, profiled directly: Winter 660, All Season 452, Summer 112. No
 * monsoon signal exists in this data at all; a monsoon-week generation's
 * eligible recipe pool is exactly the "All Season" recipes (452, well above
 * any reasonable minimum-pool threshold) — an accepted narrowing, not a
 * fabricated claim, same discipline CLAUDE.md's exchange-system seasonal
 * tagging already documents.
 */

import type { Season } from "./vocab"

const SEASON_MAP: Record<string, Season> = {
  Winter: "winter",
  Summer: "summer",
  "All Season": "all_year",
}

export function normalizeRecipeSeason(raw: string): { season: Season; unrecognized: boolean } {
  const mapped = SEASON_MAP[raw.trim()]
  return mapped ? { season: mapped, unrecognized: false } : { season: "all_year", unrecognized: true }
}
