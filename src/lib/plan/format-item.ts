import type { PlanViewItem } from "./plan-view-model"

/**
 * Grams (or ml, when the food's own household measure says so — e.g. milk)
 * is what we actually have precisely computed. The real reference PDF shows
 * richer per-food phrasing ("atta 100 g raw, 5 rotis") from a data model we
 * deliberately did not adopt (see CLAUDE.md "The exchange system") — rather
 * than invent a piece count we don't store, this shows the verified number.
 */
export function formatItemQuantity(item: PlanViewItem): string {
  if (item.servingRawG === null) {
    return item.householdMeasure ?? "1 portion"
  }
  const unit = item.householdMeasure?.toLowerCase().includes("ml") ? "ml" : "g"
  return `${Math.round(item.servingRawG)} ${unit}`
}

export function formatItemLabel(item: PlanViewItem): string {
  return `${item.nameEn} (${formatItemQuantity(item)})`
}
