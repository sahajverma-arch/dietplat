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
 * "salad"-tagged vegetables (Cucumber, Onion, Beetroot, Radish, Carrot —
 * see table41_foods.json) are kept in a SEPARATE group from everything
 * else pooled into the cooked "Mixed Vegetable {RegionWord}" dish, instead
 * of being merged in regardless of culinary fit (e.g. Beetroot landing in
 * the same "sabzi" as Capsicum/Tomato/Potato — see the conversation this
 * accompanies). A food's own `seasons` tag already governs when it's
 * eligible at all, so a winter-only salad food (Radish, Carrot) is only
 * ever grouped as salad during the season it can appear in — no separate
 * season-conditional logic needed here.
 */
const SALAD_TAG = "salad"

/**
 * Pulse items are named "{Food Name} Curry" by default (see the pulse
 * branch below) — correct for an actual dal preparation (Rajma Curry,
 * Chana dal Curry) but wrong for a pulse-exchange food whose own name
 * already IS the complete dish: a pancake (Besan Cheela, Moong Dal
 * Chilla, Pesarattu), a fritter (Kothimbir Vadi, Uzhunnu Vada, Parippu
 * Vada), a roasted snack (Bhuna Chana), or a composed meal (Misal) is
 * never called "Besan Cheela Curry" in real usage. This only became
 * visible once these foods gained a real, reachable slot (breakfast/
 * evening, see meal-distributor.ts's CEREAL_FALLBACK_ONLY_SLOTS) — they
 * existed in the dataset before that with this same wrong suffix, just
 * never selected in practice. See table41_foods.json for the tagged foods.
 */
const ALREADY_NAMED_DISH_TAG = "already_named_dish"

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
 *   Exception: a food tagged ALREADY_NAMED_DISH_TAG (a pancake, fritter,
 *   or roasted snack whose own name already is the complete dish, e.g.
 *   Besan Cheela) keeps its bare name — "Curry" is never appended.
 * - vegetable_a + vegetable_b items are split into two pools by the
 *   "salad" tag (see SALAD_TAG above), each pooled independently: 0 ->
 *   nothing emitted, 1 -> "{Food Name} {RegionWord}"/"{Food Name} Salad"
 *   single_dish, 2+ -> "Mixed Vegetable {RegionWord}"/"Salad" mixed_dish.
 *   The non-salad pool is emitted at the position of its first item, then
 *   the salad pool at the position of ITS first item — so day-to-day item
 *   order still drives which appears first in a meal's read order.
 * - Every other exchange type (cereal, milk_cow, milk_skim, meat,
 *   meat_lean, fruit, fat, sugar) passes through unchanged, one "plain"
 *   group per item.
 *
 * Original item order is preserved as the read order of the output — a
 * group is emitted at the position of the first item it consumes, and
 * later items already absorbed into an earlier group are skipped.
 */
function composeVegetablePool(pool: PlanViewItem[], singularWord: string, pluralName: string): ComposedGroup | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return { kind: "single_dish", dishName: `${pool[0].nameEn} ${singularWord}`, items: pool }
  return { kind: "mixed_dish", dishName: pluralName, items: pool }
}

export function composeMealDisplay(items: PlanViewItem[], region: string): ComposedGroup[] {
  const vegetables = items.filter((i) => VEGETABLE_EXCHANGE_TYPES.includes(i.exchangeType))
  const saladVegetables = vegetables.filter((i) => i.tags.includes(SALAD_TAG))
  const sabziVegetables = vegetables.filter((i) => !i.tags.includes(SALAD_TAG))
  const saladIds = new Set(saladVegetables.map((i) => i.id))
  const sabziIds = new Set(sabziVegetables.map((i) => i.id))
  const dishWord = vegetableDishWord(region)

  const groups: ComposedGroup[] = []
  let sabziEmitted = false
  let saladEmitted = false

  for (const item of items) {
    if (sabziIds.has(item.id)) {
      if (!sabziEmitted) {
        sabziEmitted = true
        const group = composeVegetablePool(sabziVegetables, dishWord, `Mixed Vegetable ${dishWord}`)
        if (group) groups.push(group)
      }
      continue
    }

    if (saladIds.has(item.id)) {
      if (!saladEmitted) {
        saladEmitted = true
        const group = composeVegetablePool(saladVegetables, "Salad", "Salad")
        if (group) groups.push(group)
      }
      continue
    }

    if (item.exchangeType === "pulse") {
      const dishName = item.tags.includes(ALREADY_NAMED_DISH_TAG) ? item.nameEn : `${item.nameEn} Curry`
      groups.push({ kind: "single_dish", dishName, items: [item] })
      continue
    }

    groups.push({ kind: "plain", items: [item] })
  }

  return groups
}

/**
 * The generic, un-curated "Mixed Vegetable {RegionWord}" label specifically
 * — as opposed to a curated named combo like "Aloo Gobi" or "Avial" that
 * vegetable-dish-naming.ts renames a mixed_dish group to when the exact
 * vegetable set matches a seeded combination. Only this generic case is
 * what a dietitian/client would actually call "mix veg" — the thing the
 * user explicitly asked to stop reading as an ingredient list (see the
 * conversation this accompanies): a curated combo already names its own
 * two components (Aloo Gobi IS potato+cauliflower, by definition), so
 * listing them stays useful there; the generic pool is an arbitrary
 * same-exchange-type grouping where the breakdown reads as clutter instead.
 */
export const GENERIC_MIXED_VEG_PREFIX = "Mixed Vegetable "

/** Plain-text rendering of one composed group — used by the PDF (no interactivity) and anywhere else a flat string is needed. Quantities are always shown: grouping is a display-name change, not a reason to hide clinically relevant portions — except the generic "Mixed Vegetable {word}" case, where the user explicitly asked for just the dish name and total grams, no per-vegetable breakdown (see GENERIC_MIXED_VEG_PREFIX above). */
export function formatComposedGroupPlainText(group: ComposedGroup): string {
  if (group.kind === "plain") return formatItemLabel(group.items[0])
  if (group.kind === "single_dish") return `${group.dishName} (${formatItemQuantity(group.items[0])})`

  if (group.dishName?.startsWith(GENERIC_MIXED_VEG_PREFIX)) {
    const totalGrams = group.items.reduce((sum, i) => sum + (i.servingRawG ?? 0), 0)
    return `${group.dishName} (${Math.round(totalGrams)} g)`
  }

  return `${group.dishName} (${group.items.map((i) => `${i.nameEn} ${formatItemQuantity(i)}`).join(", ")})`
}
