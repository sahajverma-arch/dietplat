/**
 * Parses recipe_database.csv (1224 real recipe rows after dropping one
 * leaked-spreadsheet garbage row, 59 columns). Column indices below were
 * read directly off the real header row, not guessed — see the header dump
 * captured during implementation. Columns 13/14 ("Base"/"Theme") are a
 * vestigial first occurrence of those header names; the real data lives at
 * columns 34/35 (same header text repeated) and is intentionally NOT read
 * here — this engine has no use for Base/Theme.
 */

import { parseCsvRows } from "./csv-parser"

const COL = {
  RECIPE_NAME: 0,
  DIET_PREF: 7,
  ALLERGEN: 8,
  SEASON: 10,
  CATEGORY: 11,
  MACRO_CATEGORY: 12,
  HEAVY_LIGHT: 15,
  CUISINE: 17,
  COMMONALITY: 19,
  QUANTITY_PER_SERVING: 33,
  MAXIMUM_QUANTITY: 43,
  MIN_QUANTITY: 44,
  RECIPE_ID: 45,
  MAIN_MID: 46,
  IS_MEASURED_IN: 47,
  WT_OF_MEASURED_AMT: 48,
  CARBS_PER_100G: 49,
  PROTEIN_PER_100G: 50,
  FAT_PER_100G: 51,
  FIBER_PER_100G: 52,
  ENERGY_PER_100G: 53, // parsed for audit only, never trusted as the kcal source
  PRIORITY: 58, // real values are "Primary"/"Secondary" text, NOT an integer — verified against the real column
} as const

export interface RawRecipeRow {
  recipeId: string
  name: string
  dietPrefRaw: string
  allergenRaw: string
  seasonRaw: string
  category: string
  macroCategoryRaw: string
  heavyLightRaw: string
  cuisineRaw: string
  commonalityRaw: string
  quantityPerServingRaw: string
  maximumQuantityRaw: string
  minQuantityRaw: string
  mainOrMidRaw: string
  isMeasuredInRaw: string
  wtOfMeasuredAmtRaw: string
  proteinPer100G: number
  carbsPer100G: number
  fatPer100G: number
  fiberPer100G: number
  priorityRaw: string
}

export interface ParsedRecipeCsv {
  rows: RawRecipeRow[]
  /** Non-empty means a genuine, unresolved name collision — seed-recipes.ts must refuse to proceed until this is empty. */
  duplicates: { name: string; rows: RawRecipeRow[] }[]
  garbageRowCount: number
}

/** The real first data row is a leaked spreadsheet COUNTA()-style artifact — every column literally holds a row-count number. */
function isGarbageRow(recipeNameRaw: string): boolean {
  return /^\d+$/.test(recipeNameRaw.trim())
}

function toRawRow(r: string[]): RawRecipeRow {
  return {
    recipeId: r[COL.RECIPE_ID].trim(),
    name: r[COL.RECIPE_NAME].trim(),
    dietPrefRaw: r[COL.DIET_PREF].trim(),
    allergenRaw: r[COL.ALLERGEN].trim(),
    seasonRaw: r[COL.SEASON].trim(),
    category: r[COL.CATEGORY].trim(),
    macroCategoryRaw: r[COL.MACRO_CATEGORY].trim(),
    heavyLightRaw: r[COL.HEAVY_LIGHT].trim(),
    cuisineRaw: r[COL.CUISINE].trim(),
    commonalityRaw: r[COL.COMMONALITY].trim(),
    quantityPerServingRaw: r[COL.QUANTITY_PER_SERVING].trim(),
    maximumQuantityRaw: r[COL.MAXIMUM_QUANTITY].trim(),
    minQuantityRaw: r[COL.MIN_QUANTITY].trim(),
    mainOrMidRaw: r[COL.MAIN_MID].trim(),
    isMeasuredInRaw: r[COL.IS_MEASURED_IN].trim(),
    wtOfMeasuredAmtRaw: r[COL.WT_OF_MEASURED_AMT].trim(),
    proteinPer100G: parseFloat(r[COL.PROTEIN_PER_100G]) || 0,
    carbsPer100G: parseFloat(r[COL.CARBS_PER_100G]) || 0,
    fatPer100G: parseFloat(r[COL.FAT_PER_100G]) || 0,
    fiberPer100G: parseFloat(r[COL.FIBER_PER_100G]) || 0,
    priorityRaw: r[COL.PRIORITY].trim(),
  }
}

function rowsAreEquivalent(a: RawRecipeRow, b: RawRecipeRow): boolean {
  return (
    a.recipeId === b.recipeId &&
    a.category === b.category &&
    a.cuisineRaw === b.cuisineRaw &&
    a.proteinPer100G === b.proteinPer100G &&
    a.carbsPer100G === b.carbsPer100G &&
    a.fatPer100G === b.fatPer100G &&
    a.fiberPer100G === b.fiberPer100G &&
    a.minQuantityRaw === b.minQuantityRaw &&
    a.maximumQuantityRaw === b.maximumQuantityRaw &&
    a.wtOfMeasuredAmtRaw === b.wtOfMeasuredAmtRaw
  )
}

/**
 * Header-indexed row mapping, tolerant of short/blank trailing rows (same
 * discipline as dish-csv-parser.ts's parseDishCsv). Two duplicate-name
 * groups were found and hand-resolved by inspecting the real file
 * (scripts/inspect-recipe-duplicates.ts):
 *
 * - "Nutri Pulav": two byte-identical rows (recipeId 792c5734-...) — a pure
 *   copy-paste duplicate, caught generically below by rowsAreEquivalent().
 * - "Fish In Lemon Butter Sauce" (recipeId 413097a8-...): two rows,
 *   identical on every column EXCEPT Category ("Heavy Meal" vs "Light
 *   Meal") — but both carry Heavy Light="Heavy" and identical serving
 *   data/macros, so "Light Meal" is an inconsistent mislabel of the SAME
 *   recipe, not a genuinely lighter portion. Dropped explicitly below,
 *   keeping the row whose Category agrees with its own Heavy Light tag.
 *
 * Neither case needed a " (2)"-style disambiguation suffix — both turned
 * out to be true duplicates once inspected, not distinct-recipe collisions.
 * The generic rowsAreEquivalent() path stays in place as a safety net for
 * any future CSV update that introduces a new name collision — those are
 * reported via `duplicates`, never silently guessed at.
 */
export function parseRecipeCsv(csvText: string): ParsedRecipeCsv {
  const allRows = parseCsvRows(csvText.trim())
  const header = allRows[0]
  const dataRows = allRows.slice(1).filter((r) => r.length >= header.length && r[COL.RECIPE_NAME]?.trim())

  const garbageRowCount = dataRows.filter((r) => isGarbageRow(r[COL.RECIPE_NAME])).length
  const realRows = dataRows.filter((r) => !isGarbageRow(r[COL.RECIPE_NAME])).map(toRawRow)

  const withoutKnownMislabel = realRows.filter((r) => !(r.name === "Fish In Lemon Butter Sauce" && r.category === "Light Meal"))

  const byName = new Map<string, RawRecipeRow[]>()
  for (const row of withoutKnownMislabel) {
    const list = byName.get(row.name) ?? []
    list.push(row)
    byName.set(row.name, list)
  }

  const rows: RawRecipeRow[] = []
  const duplicates: { name: string; rows: RawRecipeRow[] }[] = []
  for (const [name, group] of byName) {
    if (group.length === 1) {
      rows.push(group[0])
      continue
    }
    const allEquivalent = group.every((r) => rowsAreEquivalent(r, group[0]))
    if (allEquivalent) {
      rows.push(group[0])
    } else {
      duplicates.push({ name, rows: group })
    }
  }

  return { rows, duplicates, garbageRowCount }
}

export { COL as RECIPE_CSV_COL }
