/**
 * Seeds exchange_types (classic Table 4.1, 11 rows — see the migration)
 * and foods from src/db/seed-data/table41_foods.json. Every food's
 * exchangeType/servingRawG/exchangeUnits was verified by reproducing real
 * generated diet plans' exact per-meal macros — see CLAUDE.md "The
 * exchange system". Re-run with `npm run seed:foods`; upserts are
 * idempotent on (exchange_type, name_en).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { eq, sql } from "drizzle-orm"

import { db } from "./index"
import { foods } from "./schema"

interface SourceFood {
  nameEn: string
  exchangeType: string
  servingRawG: number | null
  exchangeUnits: number
  householdMeasure: string
  regions: string[]
  dietTypes: string[]
  mealSlots: string[]
  allergens?: string[]
  tags?: string[]
  /** Defaults to ["all_year"] when omitted — see SEASONS in src/lib/foods/vocab.ts. */
  seasons?: string[]
  notes?: string
}

async function main() {
  const raw = readFileSync(join(process.cwd(), "src/db/seed-data/table41_foods.json"), "utf8")
  const data = JSON.parse(raw) as { foods: SourceFood[] }

  console.log(`Seeding ${data.foods.length} foods...`)
  for (const f of data.foods) {
    const existing = await db.execute(
      sql`select id from public.foods where exchange_type = ${f.exchangeType} and name_en = ${f.nameEn} limit 1`
    )
    const values = {
      nameEn: f.nameEn,
      exchangeType: f.exchangeType,
      exchangeUnits: f.exchangeUnits,
      servingRawG: f.servingRawG,
      householdMeasure: f.householdMeasure || null,
      regions: f.regions,
      dietTypes: f.dietTypes,
      mealSlots: f.mealSlots,
      allergens: f.allergens ?? [],
      tags: f.tags ?? [],
      seasons: f.seasons ?? ["all_year"],
      notes: f.notes || null,
    }
    if (existing.length > 0) {
      // Drizzle's own update builder (not a hand-written raw sql template)
      // — raw `sql` tagged templates interpolate JS arrays as Postgres ROW
      // literals ("(a, b)"), not array literals, which is invalid syntax
      // for a text[] column (and outright fails on an empty array). The
      // insert branch below never hit this because it already goes through
      // the same builder.
      await db
        .update(foods)
        .set({
          servingRawG: values.servingRawG,
          exchangeUnits: values.exchangeUnits,
          householdMeasure: values.householdMeasure,
          regions: values.regions,
          dietTypes: values.dietTypes,
          mealSlots: values.mealSlots,
          allergens: values.allergens,
          tags: values.tags,
          seasons: values.seasons,
          notes: values.notes,
        })
        .where(eq(foods.id, (existing[0] as { id: string }).id))
    } else {
      await db.insert(foods).values(values)
    }
  }

  console.log("Done.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
