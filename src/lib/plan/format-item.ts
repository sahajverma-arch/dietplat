import type { PlanViewItem } from "./plan-view-model"

/**
 * Grams (or ml, when the food's own household measure says so — e.g. milk)
 * is what we actually have precisely computed. The real reference PDF shows
 * richer per-food phrasing ("atta 100 g raw, 5 rotis") from a data model we
 * deliberately did not adopt (see CLAUDE.md "The exchange system") — rather
 * than invent a piece count we don't store, this shows the verified number.
 *
 * meat/meat_lean are the one exception: they're indivisible whole-food
 * units (1 meat exchange = 1 whole egg, 1 meat_lean exchange = one 35 g
 * chicken/fish serving — Table 4.1), and exchangeCount is already the
 * exact, verified count of them, not something derived or guessed from the
 * gram figure. Showing it is exactly as trustworthy as the gram figure
 * itself, so it's shown alongside it (e.g. "2, 80 g").
 */
const INDIVISIBLE_EXCHANGE_TYPES = new Set(["meat", "meat_lean"])

// A direct dietitian request: always show a fruit's plain household measure
// ("1 medium") regardless of its real exchange count, never substituting in
// the count ("3 medium") the way meat/meat_lean's own carve-out below does.
// Dry fruits (Almonds, Walnut — exchangeType "fat") are unaffected either
// way, since they carry a real servingRawG and never reach this branch.
export function formatItemQuantity(item: PlanViewItem): string {
  if (item.servingRawG === null) {
    return item.householdMeasure ?? "1 portion"
  }
  const unit = item.householdMeasure?.toLowerCase().includes("ml") ? "ml" : "g"
  const grams = `${Math.round(item.servingRawG)} ${unit}`

  if (INDIVISIBLE_EXCHANGE_TYPES.has(item.exchangeType) && Number.isInteger(item.exchangeCount) && item.exchangeCount > 0) {
    return `${item.exchangeCount}, ${grams}`
  }

  return grams
}

export function formatItemLabel(item: PlanViewItem): string {
  return `${item.nameEn} (${formatItemQuantity(item)})`
}
