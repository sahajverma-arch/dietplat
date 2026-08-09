/**
 * Presentation-only layer: groups a meal's already-selected, already-priced
 * foods (PlanViewItem[]) into human-readable dish groupings before
 * rendering — e.g. Cabbage + Cauliflower + Potato becomes "Mixed Vegetable
 * Sabzi (Cabbage, Cauliflower, Potato)". This runs strictly AFTER food
 * selection, quantity pricing and validation — every PlanViewItem it
 * touches already carries its final, validated kcal/protein/carbs/fat.
 * Nothing here changes which foods were selected, their exchange counts,
 * or any macro number; it only changes how the SAME items are grouped and
 * labelled for display.
 */

import { REGIONS } from "@/lib/foods/vocab"
import { formatItemLabel, formatItemQuantity } from "./format-item"
import type { PlanViewItem } from "./plan-guidelines"
import type { ExchangeCode } from "./table-4-1"

const VEGETABLE_EXCHANGE_TYPES: ExchangeCode[] = ["vegetable_a", "vegetable_b"]

/**
 * Region -> the local word for a vegetable stir-fry/side dish.
 *
 * "Bhaji" for maharashtrian is a VERIFIED fact from this project's own
 * research, read directly off a real generated diet plan PDF (see
 * CLAUDE.md "The exchange system": "sabzi is 'Bhaji'" in Anjali's plan).
 * "Thoran" for south_indian is a best-effort match to that region's
 * documented Kerala/Malayali lean, NOT independently verified against a
 * real source PDF the way maharashtrian was. Every other seeded region has
 * no source-PDF-verified regional term in this project's data — they were
 * seeded without a real reference PDF (see table41_foods.json's _source
 * note) — so they fall back to "Sabzi", the safe, broadly pan-Indian/Hindi
 * word, rather than an invented, unverified regionalism.
 */
const VEGETABLE_DISH_WORD: Partial<Record<(typeof REGIONS)[number], string>> = {
  maharashtrian: "Bhaji",
  south_indian: "Thoran",
}
const DEFAULT_VEGETABLE_DISH_WORD = "Sabzi"

function vegetableDishWord(region: string): string {
  return VEGETABLE_DISH_WORD[region as keyof typeof VEGETABLE_DISH_WORD] ?? DEFAULT_VEGETABLE_DISH_WORD
}

export interface ComposedGroup {
  /**
   * "plain": rendered exactly as today, no dish-name wrapper (cereal,
   * milk, fruit, fat, sugar, meat, meat_lean).
   * "single_dish": one food renamed to a dish, e.g. "Rajma Curry" or
   * "Bhindi Sabzi" — no bracketed list, since there's only one food to
   * name.
   * "mixed_dish": 2+ vegetables grouped under one dish name, WITH a
   * bracketed, comma-separated list of the contributing foods —
   * traceability requirement: exactly which foods make up the dish must
   * stay visible.
   */
  kind: "plain" | "single_dish" | "mixed_dish"
  /** Only set for "single_dish" / "mixed_dish". */
  dishName?: string
  /** The real, underlying item(s) this group represents — never invented, never dropped, always traceable back to what was actually selected/priced. */
  items: PlanViewItem[]
}

/**
 * Groups one meal's items for display. Pure function — no I/O, no
 * randomness — and nothing here ever reads or writes a calorie or macro
 * number; every PlanViewItem's kcal/proteinG/carbsG/fatG pass through
 * completely untouched inside each group's `items`.
 *
 * Grouping rules:
 * - Pulse items each become their own "{Food Name} Curry" single_dish —
 *   never merged with each other or with vegetables. (Regional pulse
 *   naming falls out for free from the underlying food's own nameEn —
 *   e.g. a south_indian pulse food is already named "Parippu", so this
 *   produces "Parippu Curry" with no region-specific word list needed.)
 * - vegetable_a + vegetable_b items are pooled together: 0 -> nothing
 *   emitted for that pool, 1 -> "{Food Name} {RegionWord}" single_dish,
 *   2+ -> one "Mixed Vegetable {RegionWord}" mixed_dish holding all of
 *   them together.
 * - Every other exchange type (cereal, milk_cow, milk_skim, meat,
 *   meat_lean, fruit, fat, sugar) passes through unchanged, one "plain"
 *   group per item.
 *
 * Original item order is preserved as the read order of the output — a
 * group is emitted at the position of the first item it consumes, and
 * later items already absorbed into an earlier group are skipped.
 */
export function composeMealDisplay(items: PlanViewItem[], region: string): ComposedGroup[] {
  const vegetables = items.filter((i) => VEGETABLE_EXCHANGE_TYPES.includes(i.exchangeType))
  const vegetableIds = new Set(vegetables.map((i) => i.id))
  const dishWord = vegetableDishWord(region)

  const groups: ComposedGroup[] = []
  let vegetableGroupEmitted = false

  for (const item of items) {
    if (vegetableIds.has(item.id)) {
      if (vegetableGroupEmitted) continue
      vegetableGroupEmitted = true
      if (vegetables.length === 1) {
        groups.push({ kind: "single_dish", dishName: `${vegetables[0].nameEn} ${dishWord}`, items: vegetables })
      } else {
        groups.push({ kind: "mixed_dish", dishName: `Mixed Vegetable ${dishWord}`, items: vegetables })
      }
      continue
    }

    if (item.exchangeType === "pulse") {
      groups.push({ kind: "single_dish", dishName: `${item.nameEn} Curry`, items: [item] })
      continue
    }

    groups.push({ kind: "plain", items: [item] })
  }

  return groups
}

/** Plain-text rendering of one composed group — used by the PDF (no interactivity) and anywhere else a flat string is needed. Quantities are always shown: grouping is a display-name change, not a reason to hide clinically relevant portions. */
export function formatComposedGroupPlainText(group: ComposedGroup): string {
  if (group.kind === "plain") return formatItemLabel(group.items[0])
  if (group.kind === "single_dish") return `${group.dishName} (${formatItemQuantity(group.items[0])})`
  return `${group.dishName} (${group.items.map((i) => `${i.nameEn} ${formatItemQuantity(i)}`).join(", ")})`
}
