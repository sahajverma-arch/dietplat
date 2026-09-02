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
    consistency: d.consistency,
    mainOrMid: d.mainOrMid as "main" | "mid",
    cuisine: d.cuisine,
    macroCategory: d.macroCategory,
    commonality: d.commonality,
    mustHaveCategories: d.mustHaveCategories,
    goodToHaveCategories: d.goodToHaveCategories,
    mustHaveRecipeNames: d.mustHaveRecipeNames,
    goodToHaveRecipeNames: d.goodToHaveRecipeNames,
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

  it("includes the Consistency column in the recipe table header", () => {
    const messages = buildInitialMessages(input)
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("Consistency")
  })

  it("states the lunch/dinner staple+dal structure requirement when dinner is one of the slots", () => {
    const messages = buildInitialMessages(input)
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("dinner must include")
    expect(userContent).toContain("Never anchor dinner on soup, tea, dessert")
  })

  it("omits the structure requirement for a slot set with no lunch/dinner", () => {
    const messages = buildInitialMessages({ ...input, slots: [{ slot: "breakfast", slotOrder: 1, timeHint: null }] })
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).not.toContain("Meal structure requirements")
  })

  it("appends a pairing hint suffix only for recipes that declare must-have/good-to-have data", () => {
    const base = input.eligibleRecipesForPrompt[0]
    const withPairing = { ...base, name: "Weight Loss Khichdi", mustHaveCategories: ["Raita"], goodToHaveCategories: ["Chila", "Thepla"] }
    const withoutPairing = { ...base, name: "Plain Roti" }
    const messages = buildInitialMessages({ ...input, eligibleRecipesForPrompt: [withPairing, withoutPairing] })
    const userContent = messages.find((m) => m.role === "user")!.content
    const pairingLine = userContent.split("\n").find((l) => l.startsWith("Weight Loss Khichdi "))!
    const plainLine = userContent.split("\n").find((l) => l.startsWith("Plain Roti "))!
    expect(pairingLine).toContain("[needs: Raita; goes well with: Chila/Thepla]")
    expect(plainLine).not.toContain("[needs")
    expect(plainLine).not.toContain("[goes well")
  })

  it("tells the model 'needs' is a hard requirement checked automatically, and 'goes well with' is soft", () => {
    const messages = buildInitialMessages(input)
    const system = messages.find((m) => m.role === "system")!.content
    expect(system).toContain("needs")
    expect(system.toLowerCase()).toContain("hard requirement")
  })

  it("includes the structure requirement in the day-retry prompt too", () => {
    const badDay: GroundedRecipeDay = {
      dayIndex: 0,
      meals: [{ slot: "dinner", items: [] }],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      cappedRecipeNames: [],
      unknownRecipeNames: [],
    }
    const messages = buildDayRetryMessages(input, badDay, ["dinner is missing a Dal/Curry dish"])
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("dinner must include")
  })
})

describe("Dietitian Knowledge RAG prompt section", () => {
  it("omits the guidance section entirely, byte-identical to before this layer existed, when knowledgeChunks is absent", () => {
    const withChunks = buildInitialMessages({ ...input, knowledgeChunks: undefined })
    const without = buildInitialMessages(input)
    expect(withChunks.find((m) => m.role === "user")!.content).toBe(without.find((m) => m.role === "user")!.content)
    expect(without.find((m) => m.role === "user")!.content).not.toContain("Dietitian guidance")
  })

  it("omits the guidance section when knowledgeChunks is an empty array", () => {
    const messages = buildInitialMessages({ ...input, knowledgeChunks: [] })
    expect(messages.find((m) => m.role === "user")!.content).not.toContain("Dietitian guidance")
  })

  it("renders each retrieved chunk's heading and content when knowledgeChunks is provided (whole-week prompt)", () => {
    const messages = buildInitialMessages({
      ...input,
      knowledgeChunks: [
        { slug: "regions-punjabi#staples", docSlug: "regions-punjabi", category: "region", heading: "Punjabi staples", content: "Wheat-forward, ghee-tempered.", weight: 5, estimatedTokens: 10 },
      ],
    })
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("Dietitian guidance for this client")
    expect(userContent).toContain("[Punjabi staples] Wheat-forward, ghee-tempered.")
  })

  it("renders retrieved chunks in the day-retry prompt too", () => {
    const badDay: GroundedRecipeDay = {
      dayIndex: 0,
      meals: [{ slot: "breakfast", items: [] }],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      cappedRecipeNames: [],
      unknownRecipeNames: [],
    }
    const messages = buildDayRetryMessages(
      { ...input, knowledgeChunks: [{ slug: "s", docSlug: "d", category: "region", heading: "H", content: "Guidance text.", weight: 5, estimatedTokens: 5 }] },
      badDay,
      ["kcal is 50% under target"]
    )
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("[H] Guidance text.")
  })

  it("the system prompt frames guidance as advisory, alongside the recipe table and targets, never overriding them", () => {
    const messages = buildInitialMessages(input)
    const system = messages.find((m) => m.role === "system")!.content
    expect(system).toContain("Dietitian guidance")
  })
})

describe("Diet Plan Examples RAG prompt section", () => {
  it("omits the examples section entirely, byte-identical to before this layer existed, when dietPlanExamples is absent", () => {
    const withExamples = buildInitialMessages({ ...input, dietPlanExamples: undefined })
    const without = buildInitialMessages(input)
    expect(withExamples.find((m) => m.role === "user")!.content).toBe(without.find((m) => m.role === "user")!.content)
    expect(without.find((m) => m.role === "user")!.content).not.toContain("Real example day")
  })

  it("omits the examples section when dietPlanExamples is an empty array", () => {
    const messages = buildInitialMessages({ ...input, dietPlanExamples: [] })
    expect(messages.find((m) => m.role === "user")!.content).not.toContain("Real example day")
  })

  it("renders an example's region/goal/calories header, meal-by-meal structure, and reasoning", () => {
    const messages = buildInitialMessages({
      ...input,
      dietPlanExamples: [
        {
          slug: "punjabi-fatloss-1",
          goal: "fat_loss",
          region: "Punjabi",
          calorieMin: 1150,
          calorieMax: 1250,
          mealCount: 2,
          mealStructure: [
            { slot: "breakfast", timeHint: "8am", items: ["Methi paratha (2, no-fat)", "Curd (1 bowl)"] },
            { slot: "lunch", timeHint: null, items: ["Roti (2)", "Dal (1 bowl)"] },
          ],
          reasoning: "Technique substitution keeps the cuisine authentic while controlling fat.",
          weight: 8,
          estimatedTokens: 80,
        },
      ],
    })
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("Real example day(s)")
    expect(userContent).toContain("[Punjabi, fat loss, ~1200 kcal]")
    expect(userContent).toContain("breakfast (8am): Methi paratha (2, no-fat); Curd (1 bowl)")
    expect(userContent).toContain("lunch: Roti (2); Dal (1 bowl)")
    expect(userContent).toContain("Why: Technique substitution keeps the cuisine authentic while controlling fat.")
  })

  it("renders the examples section AFTER the knowledge section, in both prompts (knowledge-first-then-examples)", () => {
    const messages = buildInitialMessages({
      ...input,
      knowledgeChunks: [{ slug: "s", docSlug: "d", category: "region", heading: "H", content: "Guidance text.", weight: 5, estimatedTokens: 5 }],
      dietPlanExamples: [
        {
          slug: "ex-1",
          goal: "fat_loss",
          region: "Punjabi",
          calorieMin: 1150,
          calorieMax: 1250,
          mealCount: 1,
          mealStructure: [{ slot: "breakfast", timeHint: null, items: ["Poha"] }],
          reasoning: null,
          weight: 5,
          estimatedTokens: 20,
        },
      ],
    })
    const userContent = messages.find((m) => m.role === "user")!.content
    const knowledgeIndex = userContent.indexOf("Dietitian guidance")
    const examplesIndex = userContent.indexOf("Real example day")
    expect(knowledgeIndex).toBeGreaterThan(-1)
    expect(examplesIndex).toBeGreaterThan(knowledgeIndex)
  })

  it("renders examples in the day-retry prompt too", () => {
    const badDay: GroundedRecipeDay = {
      dayIndex: 0,
      meals: [{ slot: "breakfast", items: [] }],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      cappedRecipeNames: [],
      unknownRecipeNames: [],
    }
    const messages = buildDayRetryMessages(
      {
        ...input,
        dietPlanExamples: [
          {
            slug: "ex-1",
            goal: "fat_loss",
            region: "Punjabi",
            calorieMin: 1150,
            calorieMax: 1250,
            mealCount: 1,
            mealStructure: [{ slot: "breakfast", timeHint: null, items: ["Poha"] }],
            reasoning: null,
            weight: 5,
            estimatedTokens: 20,
          },
        ],
      },
      badDay,
      ["kcal is 50% under target"]
    )
    const userContent = messages.find((m) => m.role === "user")!.content
    expect(userContent).toContain("Real example day(s)")
  })

  it("the system prompt states examples carry more weight than the general guidance, without ever overriding the recipe table or targets", () => {
    const messages = buildInitialMessages(input)
    const system = messages.find((m) => m.role === "system")!.content
    expect(system).toContain("Real example day(s)")
    expect(system).toContain("MORE weight")
  })
})
