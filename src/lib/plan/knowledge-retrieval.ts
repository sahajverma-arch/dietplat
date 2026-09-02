/**
 * v1 retrieval for the Dietitian Knowledge RAG layer — deterministic
 * tag/metadata filtering, NOT semantic search (see CLAUDE.md "Dietitian
 * knowledge layer" for why: no embedding provider is confirmed available,
 * and this mirrors the recipe engine's own exact/alias/fuzzy-before-
 * embedding precedent). A doc's regions/dietTypes/goals/mealSlots arrays
 * are the filter; an EMPTY array means "applies universally" — the same
 * wildcard convention foods.seasons already uses for "all_year".
 */

import type { DietType } from "./exchange-solver"
import type { InferredGoal } from "./goal-inference"
import type { RecipeCuisine } from "@/lib/foods/recipe-cuisine-mapping"

export interface KnowledgeChunkForRetrieval {
  slug: string
  heading: string
  content: string
  estimatedTokens: number
}

export interface KnowledgeDocForRetrieval {
  slug: string
  category: string
  regions: string[]
  dietTypes: string[]
  goals: string[]
  mealSlots: string[]
  weight: number
  chunks: KnowledgeChunkForRetrieval[]
}

export interface KnowledgeRetrievalInput {
  cuisine: RecipeCuisine
  dietType: DietType
  goal: InferredGoal
  mealSlots: string[]
  maxEstimatedTokens?: number
}

export interface RetrievedKnowledgeChunk {
  slug: string
  docSlug: string
  category: string
  heading: string
  content: string
  weight: number
  estimatedTokens: number
}

export interface DroppedKnowledgeChunk {
  slug: string
  estimatedTokens: number
}

export interface KnowledgeRetrievalResult {
  chunks: RetrievedKnowledgeChunk[]
  droppedForBudget: DroppedKnowledgeChunk[]
}

export const DEFAULT_KNOWLEDGE_TOKEN_BUDGET = 700

// Same small per-file 32-bit rolling hash duplicated independently in
// food-selector-fallback.ts / daily-macro-jitter.ts / archetype-selector.ts
// / mixed-veg-day.ts / recipe-selector-fallback.ts — this codebase's own
// explicit, repeated choice not to share this helper. Used here purely as
// a deterministic tie-break among equally-ranked chunks, not a real
// relevance signal.
function stableHash(...parts: (string | number)[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

function isDocEligible(doc: KnowledgeDocForRetrieval, input: KnowledgeRetrievalInput): boolean {
  const regionMatch = doc.regions.length === 0 || doc.regions.includes(input.cuisine)
  const dietTypeMatch = doc.dietTypes.length === 0 || doc.dietTypes.includes(input.dietType)
  const goalMatch = doc.goals.length === 0 || doc.goals.includes(input.goal)
  const mealSlotMatch = doc.mealSlots.length === 0 || doc.mealSlots.some((s) => input.mealSlots.includes(s))
  return regionMatch && dietTypeMatch && goalMatch && mealSlotMatch
}

function specificity(doc: KnowledgeDocForRetrieval): number {
  return [doc.regions, doc.dietTypes, doc.goals, doc.mealSlots].filter((arr) => arr.length > 0).length
}

export function retrieveKnowledgeChunks(allDocs: KnowledgeDocForRetrieval[], input: KnowledgeRetrievalInput): KnowledgeRetrievalResult {
  const budget = input.maxEstimatedTokens ?? DEFAULT_KNOWLEDGE_TOKEN_BUDGET

  const candidates = allDocs
    .filter((doc) => isDocEligible(doc, input))
    .flatMap((doc) =>
      doc.chunks.map((chunk) => ({
        slug: chunk.slug,
        docSlug: doc.slug,
        category: doc.category,
        heading: chunk.heading,
        content: chunk.content,
        weight: doc.weight,
        estimatedTokens: chunk.estimatedTokens,
        // carried only for ranking, not part of the returned shape
        __specificity: specificity(doc),
      }))
    )

  const ranked = candidates.sort((a, b) => {
    if (a.__specificity !== b.__specificity) return b.__specificity - a.__specificity
    if (a.weight !== b.weight) return b.weight - a.weight
    return stableHash(a.slug) - stableHash(b.slug)
  })

  const chunks: RetrievedKnowledgeChunk[] = []
  const droppedForBudget: DroppedKnowledgeChunk[] = []
  let usedTokens = 0
  for (const candidate of ranked) {
    if (usedTokens + candidate.estimatedTokens <= budget) {
      chunks.push({
        slug: candidate.slug,
        docSlug: candidate.docSlug,
        category: candidate.category,
        heading: candidate.heading,
        content: candidate.content,
        weight: candidate.weight,
        estimatedTokens: candidate.estimatedTokens,
      })
      usedTokens += candidate.estimatedTokens
    } else {
      droppedForBudget.push({ slug: candidate.slug, estimatedTokens: candidate.estimatedTokens })
    }
  }

  return { chunks, droppedForBudget }
}
