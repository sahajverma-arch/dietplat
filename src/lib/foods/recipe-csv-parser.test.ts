import { describe, expect, it } from "vitest"

import { parseRecipeCsv, RECIPE_CSV_COL } from "./recipe-csv-parser"

// Minimal 59-column header/row builder — only the columns this module reads
// need real values; everything else can be blank.
function makeHeader(): string {
  return Array.from({ length: 59 }, () => "col").join(",")
}

function makeRow(overrides: Partial<Record<keyof typeof RECIPE_CSV_COL, string>>): string {
  const cols = Array.from({ length: 59 }, () => "")
  for (const [key, value] of Object.entries(overrides)) {
    cols[RECIPE_CSV_COL[key as keyof typeof RECIPE_CSV_COL]] = value ?? ""
  }
  return cols.join(",")
}

describe("parseRecipeCsv", () => {
  it("parses a well-formed row into a RawRecipeRow", () => {
    const csv = [
      makeHeader(),
      makeRow({
        RECIPE_NAME: "Aloo Paratha",
        RECIPE_ID: "id-1",
        DIET_PREF: "VEGETARIAN",
        PROTEIN_PER_100G: "5",
        CARBS_PER_100G: "20",
        FAT_PER_100G: "6",
        FIBER_PER_100G: "2",
        CONSISTENCY: "Solid",
      }),
    ].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      name: "Aloo Paratha",
      recipeId: "id-1",
      proteinPer100G: 5,
      carbsPer100G: 20,
      fatPer100G: 6,
      fiberPer100G: 2,
      consistencyRaw: "Solid",
    })
    expect(result.duplicates).toEqual([])
    expect(result.garbageRowCount).toBe(0)
  })

  it("drops the leaked-spreadsheet garbage row (purely numeric Recipe Name)", () => {
    const csv = [makeHeader(), makeRow({ RECIPE_NAME: "1224" }), makeRow({ RECIPE_NAME: "Real Recipe" })].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.garbageRowCount).toBe(1)
    expect(result.rows.map((r) => r.name)).toEqual(["Real Recipe"])
  })

  it("silently collapses a byte-identical duplicate row, keeping the first", () => {
    const row = { RECIPE_NAME: "Nutri Pulav", RECIPE_ID: "dup-id", CATEGORY: "Pulao", CUISINE: "General", PROTEIN_PER_100G: "2.1" }
    const csv = [makeHeader(), makeRow(row), makeRow(row)].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.duplicates).toEqual([])
  })

  it("drops the known Fish In Lemon Butter Sauce mislabel (Light Meal disagrees with its own Heavy Light tag)", () => {
    const csv = [
      makeHeader(),
      makeRow({ RECIPE_NAME: "Fish In Lemon Butter Sauce", RECIPE_ID: "fish-id", CATEGORY: "Heavy Meal", HEAVY_LIGHT: "Heavy" }),
      makeRow({ RECIPE_NAME: "Fish In Lemon Butter Sauce", RECIPE_ID: "fish-id", CATEGORY: "Light Meal", HEAVY_LIGHT: "Heavy" }),
    ].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].category).toBe("Heavy Meal")
    expect(result.duplicates).toEqual([])
  })

  it("reports a genuine, non-equivalent name collision as an unresolved duplicate rather than guessing", () => {
    const csv = [
      makeHeader(),
      makeRow({ RECIPE_NAME: "Mystery Dish", RECIPE_ID: "a", PROTEIN_PER_100G: "5" }),
      makeRow({ RECIPE_NAME: "Mystery Dish", RECIPE_ID: "b", PROTEIN_PER_100G: "50" }),
    ].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0].name).toBe("Mystery Dish")
    expect(result.duplicates[0].rows).toHaveLength(2)
  })

  it("parses the four Must/Good-to-have Category/Recipe pairing columns", () => {
    const csv = [
      makeHeader(),
      makeRow({
        RECIPE_NAME: "Dahi Tadka",
        MUST_HAVE_CATEGORY: '"Pulao, Khichdi, Biryani"',
        GOOD_TO_HAVE_CATEGORY: '"Chila, Thepla"',
        MUST_HAVE_RECIPE: "",
        GOOD_TO_HAVE_RECIPE: "",
      }),
    ].join("\n")
    const result = parseRecipeCsv(csv)
    expect(result.rows[0]).toMatchObject({
      mustHaveCategoryRaw: "Pulao, Khichdi, Biryani",
      goodToHaveCategoryRaw: "Chila, Thepla",
      mustHaveRecipeRaw: "",
      goodToHaveRecipeRaw: "",
    })
  })

  it("skips a blank-name row", () => {
    const csv = [makeHeader(), makeRow({ RECIPE_NAME: "" })].join("\n")
    expect(parseRecipeCsv(csv).rows).toEqual([])
  })
})
