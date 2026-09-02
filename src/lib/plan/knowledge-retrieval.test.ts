import { describe, expect, it } from "vitest"

import { DEFAULT_KNOWLEDGE_TOKEN_BUDGET, retrieveKnowledgeChunks, type KnowledgeDocForRetrieval } from "./knowledge-retrieval"

function makeDoc(overrides: Partial<KnowledgeDocForRetrieval> & { slug: string }): KnowledgeDocForRetrieval {
  return {
    category: "region",
    regions: [],
    dietTypes: [],
    goals: [],
    mealSlots: [],
    weight: 5,
    chunks: [{ slug: `${overrides.slug}#c1`, heading: "Heading", content: "Some guidance text.", estimatedTokens: 10 }],
    ...overrides,
  }
}

const BASE_INPUT = { cuisine: "Punjabi" as const, dietType: "vegetarian" as const, goal: "fat_loss" as const, mealSlots: ["breakfast", "lunch"] }

describe("retrieveKnowledgeChunks", () => {
  it("includes a universal doc (all filter arrays empty) regardless of client profile", () => {
    const universal = makeDoc({ slug: "universal" })
    const { chunks } = retrieveKnowledgeChunks([universal], BASE_INPUT)
    expect(chunks.map((c) => c.docSlug)).toEqual(["universal"])
  })

  it("excludes a doc whose regions filter doesn't include the requested cuisine", () => {
    const gujaratiOnly = makeDoc({ slug: "gujarati-only", regions: ["Gujarati"] })
    const { chunks } = retrieveKnowledgeChunks([gujaratiOnly], BASE_INPUT)
    expect(chunks).toHaveLength(0)
  })

  it("includes a doc whose regions filter matches the requested cuisine", () => {
    const punjabiDoc = makeDoc({ slug: "punjabi-doc", regions: ["Punjabi"] })
    const { chunks } = retrieveKnowledgeChunks([punjabiDoc], BASE_INPUT)
    expect(chunks.map((c) => c.docSlug)).toEqual(["punjabi-doc"])
  })

  it("excludes a doc on a dietType mismatch even if region matches", () => {
    const nonVegOnly = makeDoc({ slug: "nonveg-only", regions: ["Punjabi"], dietTypes: ["non_vegetarian"] })
    const { chunks } = retrieveKnowledgeChunks([nonVegOnly], BASE_INPUT)
    expect(chunks).toHaveLength(0)
  })

  it("excludes a doc on a goal mismatch", () => {
    const muscleGainOnly = makeDoc({ slug: "muscle-gain-only", goals: ["muscle_gain"] })
    const { chunks } = retrieveKnowledgeChunks([muscleGainOnly], BASE_INPUT)
    expect(chunks).toHaveLength(0)
  })

  it("includes a doc when mealSlots intersects the requested slots (not full containment)", () => {
    const dinnerAndBreakfast = makeDoc({ slug: "slot-doc", mealSlots: ["dinner", "breakfast"] })
    const { chunks } = retrieveKnowledgeChunks([dinnerAndBreakfast], BASE_INPUT)
    expect(chunks.map((c) => c.docSlug)).toEqual(["slot-doc"])
  })

  it("excludes a doc whose mealSlots don't intersect the requested slots at all", () => {
    const eveningOnly = makeDoc({ slug: "evening-only", mealSlots: ["evening"] })
    const { chunks } = retrieveKnowledgeChunks([eveningOnly], BASE_INPUT)
    expect(chunks).toHaveLength(0)
  })

  it("ranks a more specific eligible doc above a universal one", () => {
    const universal = makeDoc({ slug: "universal" })
    const specific = makeDoc({ slug: "specific", regions: ["Punjabi"], goals: ["fat_loss"] })
    const { chunks } = retrieveKnowledgeChunks([universal, specific], BASE_INPUT)
    expect(chunks[0].docSlug).toBe("specific")
    expect(chunks[1].docSlug).toBe("universal")
  })

  it("uses weight as a tie-breaker when specificity is equal", () => {
    const lowWeight = makeDoc({ slug: "low-weight", weight: 1 })
    const highWeight = makeDoc({ slug: "high-weight", weight: 9 })
    const { chunks } = retrieveKnowledgeChunks([lowWeight, highWeight], BASE_INPUT)
    expect(chunks[0].docSlug).toBe("high-weight")
  })

  it("is deterministic across repeated calls with the same input (stable tie-break, not array order)", () => {
    const a = makeDoc({ slug: "doc-a" })
    const b = makeDoc({ slug: "doc-b" })
    const first = retrieveKnowledgeChunks([a, b], BASE_INPUT).chunks.map((c) => c.docSlug)
    const second = retrieveKnowledgeChunks([b, a], BASE_INPUT).chunks.map((c) => c.docSlug)
    expect(first).toEqual(second)
  })

  it("stops including chunks once the token budget is exhausted, and reports the rest as dropped", () => {
    const docs = [
      makeDoc({ slug: "a", chunks: [{ slug: "a#c1", heading: "A", content: "x", estimatedTokens: 400 }] }),
      makeDoc({ slug: "b", chunks: [{ slug: "b#c1", heading: "B", content: "x", estimatedTokens: 400 }] }),
    ]
    const { chunks, droppedForBudget } = retrieveKnowledgeChunks(docs, { ...BASE_INPUT, maxEstimatedTokens: 500 })
    expect(chunks).toHaveLength(1)
    expect(droppedForBudget).toHaveLength(1)
    expect(droppedForBudget[0].estimatedTokens).toBe(400)
  })

  it("defaults the token budget to DEFAULT_KNOWLEDGE_TOKEN_BUDGET when not specified", () => {
    const bigDoc = makeDoc({
      slug: "big",
      chunks: [{ slug: "big#c1", heading: "Big", content: "x", estimatedTokens: DEFAULT_KNOWLEDGE_TOKEN_BUDGET + 1 }],
    })
    const { chunks, droppedForBudget } = retrieveKnowledgeChunks([bigDoc], BASE_INPUT)
    expect(chunks).toHaveLength(0)
    expect(droppedForBudget).toHaveLength(1)
  })

  it("never silently drops a chunk — every excluded-for-budget chunk appears in droppedForBudget", () => {
    const docs = Array.from({ length: 5 }, (_, i) =>
      makeDoc({ slug: `doc-${i}`, chunks: [{ slug: `doc-${i}#c1`, heading: "H", content: "x", estimatedTokens: 300 }] })
    )
    const { chunks, droppedForBudget } = retrieveKnowledgeChunks(docs, { ...BASE_INPUT, maxEstimatedTokens: 500 })
    expect(chunks.length + droppedForBudget.length).toBe(5)
  })

  it("a smaller lower-ranked chunk can still fit after a larger higher-ranked chunk is dropped (best-effort greedy)", () => {
    const docs = [
      makeDoc({ slug: "big", weight: 9, chunks: [{ slug: "big#c1", heading: "Big", content: "x", estimatedTokens: 600 }] }),
      makeDoc({ slug: "small", weight: 1, chunks: [{ slug: "small#c1", heading: "Small", content: "x", estimatedTokens: 50 }] }),
    ]
    const { chunks, droppedForBudget } = retrieveKnowledgeChunks(docs, { ...BASE_INPUT, maxEstimatedTokens: 500 })
    expect(chunks.map((c) => c.docSlug)).toEqual(["small"])
    expect(droppedForBudget.map((d) => d.slug)).toEqual(["big#c1"])
  })
})
