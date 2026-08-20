import { describe, expect, it } from "vitest"

import { buildDayRetryMessages, buildDaySchemaExample, buildInitialMessages } from "./recipe-prompt"
import { llmRecipeDaySchema, llmRecipeSelectionSchema } from "./recipe-schema"
import { makeRecipe } from "./test-fixtures"
import type { GroundedRecipeDay, RecipeSelectorInput } from "./recipe-types"

const dish1 = makeRecipe({ id: "1", name: "Roti" })
const dish2 = makeRecipe({ id: "2", name: "Dal" })

const input: RecipeSelectorInput = {
  cuisine: "North Indian",
  dietType: "vegetarian",
  mealCount: 2,
  dailyTarget: { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 30 },
  slots: [
    { slot: "breakfast", slotOrder: 1, timeHint: "08:00" },
    { slot: "dinner", slotOrder: 2, timeHint: "20:00" },
  ],
  eligibleRecipesForPrompt: [dish1, dish2].map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    mainOrMid: d.mainOrMid as "main" | "mid",
    cuisine: d.cuisine,
    macroCategory: d.macroCategory,
    commonality: d.commonality,
    proteinPer100G: d.proteinPer100G,
    carbsPer100G: d.carbsPer100G,
    fatPer100G: d.fatPer100G,
    fiberPer100G: d.fiberPer100G,
    kcalPer100G: d.kcalPer100G,
  })),
  allRecipesById: new Map(),
  eligibleCuisines: ["North Indian", "General"],
  clientAllergenTags: [],
  aliasRows: [],
}

function extractEmbeddedSchema(userContent: string): unknown {
  const markerIdx = userContent.indexOf("schema exactly")
  const braceIdx = userContent.indexOf("{", markerIdx)
  return JSON.parse(userContent.slice(braceIdx).trim())
}

describe("prompt schema examples match what's actually parsed", () => {
  it("buildInitialMessages' embedded schema example matches llmRecipeSelectionSchema's wrapped {days:[...]} shape", () => {
    const messages = buildInitialMessages(input)
    const userContent = messages.find((m) => m.role === "user")!.content
    const parsed = extractEmbeddedSchema(userContent) as { days: unknown[] }
    expect(Array.isArray(parsed.days)).toBe(true)
    expect(() => llmRecipeDaySchema.parse(parsed.days[0])).not.toThrow()
    const padded = { days: Array.from({ length: 7 }, (_, i) => ({ ...(parsed.days[0] as object), dayIndex: i })) }
    expect(() => llmRecipeSelectionSchema.parse(padded)).not.toThrow()
  })

  it("buildDayRetryMessages' embedded schema example parses against llmRecipeDaySchema (the UNWRAPPED single-day shape)", () => {
    const badDay: GroundedRecipeDay = {
      dayIndex: 3,
      meals: [{ slot: "breakfast", items: [] }],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      cappedRecipeNames: [],
      unknownRecipeNames: [],
    }
    const messages = buildDayRetryMessages(input, badDay, ["kcal is 50% under target"])
    const userContent = messages.find((m) => m.role === "user")!.content
    const parsed = extractEmbeddedSchema(userContent)
    expect(() => llmRecipeDaySchema.parse(parsed)).not.toThrow()
    expect(parsed).toHaveProperty("dayIndex", 0)
    expect(parsed).not.toHaveProperty("days")
  })

  it("buildDaySchemaExample() itself always parses against llmRecipeDaySchema", () => {
    expect(() => llmRecipeDaySchema.parse(JSON.parse(buildDaySchemaExample()))).not.toThrow()
  })
})

describe("buildInitialMessages / buildDayRetryMessages content", () => {
  it("explicitly tells the model it will never output a gram/calorie/macro figure", () => {
    const messages = buildInitialMessages(input)
    const system = messages.find((m) => m.role === "system")!.content
    expect(system.toLowerCase()).toContain("never calculate, estimate, or output a calorie, macro, or gram figure")
  })

  it("includes every eligible recipe's exact name in the prompt table", () => {
    const messages = buildInitialMessages(input)
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("Roti")
    expect(userContent).toContain("Dal")
  })
})
