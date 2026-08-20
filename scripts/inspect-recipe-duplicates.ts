/**
 * One-off diagnostic (not part of the permanent ingestion pipeline). Groups
 * the raw recipe CSV by RECIPE ID (col 45) and by Recipe Name (col 0),
 * prints every group with >1 row side-by-side so a human can decide, per
 * group: (a) true duplicate — dedupe, keep first — or (b) a genuine name/id
 * collision on different recipes — keep both, second gets " (2)" suffixed.
 * The decision gets hardcoded into recipe-csv-parser.ts afterward; this
 * script never runs as part of a real seed.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { parseCsvRows } from "../src/lib/foods/csv-parser"

const CSV_PATH = join(__dirname, "..", "src", "db", "seed-data", "recipe_database.csv")

const COL = {
  RECIPE_NAME: 0,
  RECIPE_ID: 45,
} as const

function isGarbageRow(recipeNameRaw: string): boolean {
  return /^\d+$/.test(recipeNameRaw.trim())
}

function main() {
  const text = readFileSync(CSV_PATH, "utf8")
  const rows = parseCsvRows(text.trim())
  const header = rows[0]
  const dataRows = rows.slice(1).filter((r) => r.length >= header.length && r[COL.RECIPE_NAME]?.trim())

  const garbage = dataRows.filter((r) => isGarbageRow(r[COL.RECIPE_NAME]))
  console.log(`Total data rows (pre-garbage-filter): ${dataRows.length}`)
  console.log(`Garbage rows found (purely numeric Recipe Name): ${garbage.length}`)
  garbage.forEach((r) => console.log(`  - "${r[COL.RECIPE_NAME]}"`))

  const realRows = dataRows.filter((r) => !isGarbageRow(r[COL.RECIPE_NAME]))
  console.log(`Real data rows: ${realRows.length}`)

  function groupBy(colIdx: number) {
    const map = new Map<string, string[][]>()
    for (const r of realRows) {
      const key = r[colIdx]?.trim() ?? ""
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return [...map.entries()].filter(([, rs]) => rs.length > 1)
  }

  console.log("\n=== Duplicate RECIPE ID groups ===")
  for (const [id, rs] of groupBy(COL.RECIPE_ID)) {
    console.log(`\nRECIPE ID "${id}" — ${rs.length} rows:`)
    for (const r of rs) {
      console.log(`  name=${JSON.stringify(r[COL.RECIPE_NAME])} category=${JSON.stringify(r[11])} cuisine=${JSON.stringify(r[17])} protein/100g=${r[50]} carbs/100g=${r[49]} fat/100g=${r[51]} fiber/100g=${r[52]}`)
    }
  }

  console.log("\n=== Duplicate Recipe Name groups ===")
  for (const [name, rs] of groupBy(COL.RECIPE_NAME)) {
    console.log(`\nRecipe Name "${name}" — ${rs.length} rows:`)
    for (const r of rs) {
      console.log(`  recipeId=${JSON.stringify(r[COL.RECIPE_ID])} category=${JSON.stringify(r[11])} cuisine=${JSON.stringify(r[17])} protein/100g=${r[50]} carbs/100g=${r[49]} fat/100g=${r[51]} fiber/100g=${r[52]}`)
    }
  }
}

main()
