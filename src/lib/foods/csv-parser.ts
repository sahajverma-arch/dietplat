/**
 * Generic quoted-CSV state machine — handles embedded commas/quotes/newlines
 * inside quoted fields, which a naive split(",")/split("\n") would corrupt.
 * Shared by every CSV ingestion pipeline in this codebase (originally
 * written for indian_food_composition_database.csv's ingredients_json
 * column; the recipe engine's "All Ingredients" column has the exact same
 * embedded-newline shape).
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(cur)
      cur = ""
    } else if (c === "\n") {
      row.push(cur)
      cur = ""
      rows.push(row)
      row = []
    } else if (c === "\r") {
      // skip
    } else {
      cur += c
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}
