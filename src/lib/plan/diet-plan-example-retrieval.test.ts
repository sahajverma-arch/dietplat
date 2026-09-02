import { describe, expect, it } from "vitest"

import { DEFAULT_EXAMPLE_TOKEN_BUDGET, DEFAULT_MAX_EXAMPLES, retrieveDietPlanExamples, type DietPlanExampleForRetrieval } from "./diet-plan-example-retrieval"

function makeExample(overrides: Partial<DietPlanExampleForRetrieval> & { slug: string }): DietPlanExampleForRetrieval {
  return {
    goal: "fat_loss",
    dietTypes: ["vegetarian", "eggetarian"],
    region: "Punjabi",
    gender: "any",
    calorieMin: 1150,
    calorieMax: 1250,
    mealCount: 6,
    mealStructure: [{ slot: "breakfast", timeHint: null, items: ["Methi paratha"] }],
    reasoning: null,
    weight: 5,
    sourceType: "real",
    estimatedTokens: 100,
    ...overrides,
  }
}

const BASE_INPUT = { goal: "fat_loss" as const, dietType: "vegetarian" as const, cuisine: "Punjabi" as const, dailyTargetKcal: 1200, mealCount: 6 }

describe("retrieveDietPlanExamples", () => {
  it("excludes an example with a different goal", () => {
    const wrongGoal = makeExample({ slug: "mg", goal: "muscle_gain" })
    const { examples } = retrieveDietPlanExamples([wrongGoal], BASE_INPUT)
    expect(examples).toHaveLength(0)
  })

  it("excludes an example whose dietTypes don't include the client's diet type", () => {
    const nonVegOnly = makeExample({ slug: "nonveg", dietTypes: ["non_vegetarian"] })
    const { examples } = retrieveDietPlanExamples([nonVegOnly], BASE_INPUT)
    expect(examples).toHaveLength(0)
  })

  it("includes an example whose dietTypes list includes the client's diet type", () => {
    const vegOk = makeExample({ slug: "veg-ok" })
    const { examples } = retrieveDietPlanExamples([vegOk], BASE_INPUT)
    expect(examples.map((e) => e.slug)).toEqual(["veg-ok"])
  })

  it("ranks an exact region match above a General example", () => {
    const general = makeExample({ slug: "general", region: "General" })
    const exact = makeExample({ slug: "exact", region: "Punjabi" })
    const { examples } = retrieveDietPlanExamples([general, exact], { ...BASE_INPUT, maxExamples: 2 })
    expect(examples[0].slug).toBe("exact")
    expect(examples[1].slug).toBe("general")
  })

  it("ranks a closer calorie match above a farther one", () => {
    const close = makeExample({ slug: "close", calorieMin: 1150, calorieMax: 1250 })
    const far = makeExample({ slug: "far", calorieMin: 2200, calorieMax: 2400 })
    const { examples } = retrieveDietPlanExamples([close, far], { ...BASE_INPUT, maxExamples: 2 })
    expect(examples[0].slug).toBe("close")
  })

  it("real examples always outrank eligible synthetic examples, even at a lower raw score", () => {
    const syntheticHighScore = makeExample({ slug: "synthetic-good", sourceType: "synthetic", region: "Punjabi", calorieMin: 1150, calorieMax: 1250 })
    const realLowerScore = makeExample({ slug: "real-ok", sourceType: "real", region: "General", calorieMin: 1900, calorieMax: 2100 })
    const { examples } = retrieveDietPlanExamples([syntheticHighScore, realLowerScore], BASE_INPUT)
    expect(examples.map((e) => e.slug)).toEqual(["real-ok"])
  })

  it("falls back to a synthetic example when no real example is eligible (real-first, synthetic-as-filler)", () => {
    const synthetic = makeExample({ slug: "synthetic-only", sourceType: "synthetic" })
    const { examples } = retrieveDietPlanExamples([synthetic], BASE_INPUT)
    expect(examples.map((e) => e.slug)).toEqual(["synthetic-only"])
  })

  it("fills remaining slots with synthetic examples after the real pool is exhausted", () => {
    const real1 = makeExample({ slug: "real-1", sourceType: "real" })
    const synthetic1 = makeExample({ slug: "synthetic-1", sourceType: "synthetic" })
    const { examples } = retrieveDietPlanExamples([real1, synthetic1], { ...BASE_INPUT, maxExamples: 2 })
    expect(examples.map((e) => e.slug)).toEqual(["real-1", "synthetic-1"])
  })

  it("is deterministic across repeated calls regardless of input array order", () => {
    const a = makeExample({ slug: "a" })
    const b = makeExample({ slug: "b" })
    const first = retrieveDietPlanExamples([a, b], BASE_INPUT).examples.map((e) => e.slug)
    const second = retrieveDietPlanExamples([b, a], BASE_INPUT).examples.map((e) => e.slug)
    expect(first).toEqual(second)
  })

  it("respects DEFAULT_MAX_EXAMPLES = 1 when not specified", () => {
    const a = makeExample({ slug: "a" })
    const b = makeExample({ slug: "b" })
    expect(DEFAULT_MAX_EXAMPLES).toBe(1)
    const { examples } = retrieveDietPlanExamples([a, b], BASE_INPUT)
    expect(examples).toHaveLength(1)
  })

  it("drops an example over the token budget and reports it in droppedForBudget", () => {
    const big = makeExample({ slug: "big", estimatedTokens: DEFAULT_EXAMPLE_TOKEN_BUDGET + 1 })
    const { examples, droppedForBudget } = retrieveDietPlanExamples([big], BASE_INPUT)
    expect(examples).toHaveLength(0)
    expect(droppedForBudget).toEqual([{ slug: "big", estimatedTokens: DEFAULT_EXAMPLE_TOKEN_BUDGET + 1 }])
  })

  it("never silently drops a candidate — every over-budget candidate appears in droppedForBudget", () => {
    const a = makeExample({ slug: "a", estimatedTokens: 600 })
    const { examples, droppedForBudget } = retrieveDietPlanExamples([a], { ...BASE_INPUT, maxEstimatedTokens: 500 })
    expect(examples.length + droppedForBudget.length).toBe(1)
  })

  it("does not over-penalize an absent client-gender signal (accepted v1 gap)", () => {
    const genderedExample = makeExample({ slug: "gendered", gender: "male" })
    const { examples } = retrieveDietPlanExamples([genderedExample], BASE_INPUT)
    expect(examples).toHaveLength(1) // still surfaces — soft score, not a hard exclusion
  })
})
