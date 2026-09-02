/**
 * Diet Plan Examples RAG layer's retrieval — genuinely different in kind
 * from knowledge-retrieval.ts's hard-filter-only approach: this needs real
 * similarity ranking (region/calorie-closeness/meal-count-closeness/
 * gender) plus a real/synthetic tiering (real examples always outrank
 * eligible synthetic ones; synthetic only fills gaps the real set doesn't
 * reach). See CLAUDE.md "Diet plan examples layer".
 */

import type { RecipeCuisine } from "@/lib/foods/recipe-cuisine-mapping"

import type { DietType } from "./exchange-solver"
import type { DietPlanExampleGoal, DietPlanExampleSourceType, ParsedMealSlot } from "./diet-plan-example-markdown-parser"

export interface DietPlanExampleForRetrieval {
  slug: string
  goal: DietPlanExampleGoal
  dietTypes: string[]
  region: string
  gender: "male" | "female" | "any"
  calorieMin: number
  calorieMax: number
  mealCount: number
  mealStructure: ParsedMealSlot[]
  reasoning: string | null
  weight: number
  sourceType: DietPlanExampleSourceType
  estimatedTokens: number
}

export interface DietPlanExampleRetrievalInput {
  goal: DietPlanExampleGoal
  dietType: DietType
  cuisine: RecipeCuisine
  dailyTargetKcal: number
  mealCount: number
  clientGender?: "male" | "female"
  maxExamples?: number
  maxEstimatedTokens?: number
}

export interface RetrievedDietPlanExample {
  slug: string
  goal: DietPlanExampleGoal
  region: string
  calorieMin: number
  calorieMax: number
  mealCount: number
  mealStructure: ParsedMealSlot[]
  reasoning: string | null
  weight: number
  estimatedTokens: number
}

export interface DroppedDietPlanExample {
  slug: string
  estimatedTokens: number
}

export interface DietPlanExampleRetrievalResult {
  examples: RetrievedDietPlanExample[]
  droppedForBudget: DroppedDietPlanExample[]
}

export const DEFAULT_MAX_EXAMPLES = 1
export const DEFAULT_EXAMPLE_TOKEN_BUDGET = 500

// Same small per-file 32-bit rolling hash duplicated independently in
// knowledge-retrieval.ts and 5 other files — this codebase's own explicit,
// repeated choice not to share this helper. A deterministic tie-break
// only, not a relevance signal.
function stableHash(...parts: (string | number)[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

function isEligible(example: DietPlanExampleForRetrieval, input: DietPlanExampleRetrievalInput): boolean {
  return example.goal === input.goal && example.dietTypes.includes(input.dietType)
}

const CALORIE_SCORE_DENOMINATOR = 500

function regionScore(exampleRegion: string, cuisine: RecipeCuisine): number {
  if (exampleRegion === cuisine) return 1.0
  if (exampleRegion === "General" || cuisine === "General") return 0.5
  return 0.15
}

function calorieScore(calorieMin: number, calorieMax: number, targetKcal: number): number {
  if (targetKcal >= calorieMin && targetKcal <= calorieMax) return 1.0
  const distance = targetKcal < calorieMin ? calorieMin - targetKcal : targetKcal - calorieMax
  return Math.max(0, 1 - distance / CALORIE_SCORE_DENOMINATOR)
}

function mealCountScore(exampleMealCount: number, requestedMealCount: number): number {
  const diff = Math.abs(exampleMealCount - requestedMealCount)
  if (diff === 0) return 1.0
  if (diff === 1) return 0.6
  if (diff === 2) return 0.3
  return 0
}

function genderScore(exampleGender: "male" | "female" | "any", clientGender: "male" | "female" | undefined): number {
  if (exampleGender === "any") return 1.0
  if (clientGender === undefined) return 0.6 // no client-gender signal exists upstream today — accepted v1 gap, don't over-penalize
  return exampleGender === clientGender ? 1.0 : 0.4
}

function finalScore(example: DietPlanExampleForRetrieval, input: DietPlanExampleRetrievalInput): number {
  const composite =
    regionScore(example.region, input.cuisine) * 0.4 +
    calorieScore(example.calorieMin, example.calorieMax, input.dailyTargetKcal) * 0.35 +
    mealCountScore(example.mealCount, input.mealCount) * 0.15 +
    genderScore(example.gender, input.clientGender) * 0.1
  return composite * (example.weight / 10)
}

function rank(examples: DietPlanExampleForRetrieval[], input: DietPlanExampleRetrievalInput): DietPlanExampleForRetrieval[] {
  return [...examples].sort((a, b) => {
    const scoreDiff = finalScore(b, input) - finalScore(a, input)
    if (scoreDiff !== 0) return scoreDiff
    return stableHash(a.slug) - stableHash(b.slug)
  })
}

export function retrieveDietPlanExamples(allExamples: DietPlanExampleForRetrieval[], input: DietPlanExampleRetrievalInput): DietPlanExampleRetrievalResult {
  const maxExamples = input.maxExamples ?? DEFAULT_MAX_EXAMPLES
  const budget = input.maxEstimatedTokens ?? DEFAULT_EXAMPLE_TOKEN_BUDGET

  const eligible = allExamples.filter((e) => isEligible(e, input))
  const real = rank(
    eligible.filter((e) => e.sourceType === "real"),
    input
  )
  const synthetic = rank(
    eligible.filter((e) => e.sourceType === "synthetic"),
    input
  )

  // Real-first, synthetic-as-filler: fill maxExamples slots from the
  // real-ranked list first; only once it's exhausted does the
  // synthetic-ranked list fill the remainder. A synthetic example can
  // never outrank an eligible real one.
  const orderedCandidates = [...real, ...synthetic].slice(0, maxExamples)

  const examples: RetrievedDietPlanExample[] = []
  const droppedForBudget: DroppedDietPlanExample[] = []
  let usedTokens = 0
  for (const candidate of orderedCandidates) {
    if (usedTokens + candidate.estimatedTokens <= budget) {
      examples.push({
        slug: candidate.slug,
        goal: candidate.goal,
        region: candidate.region,
        calorieMin: candidate.calorieMin,
        calorieMax: candidate.calorieMax,
        mealCount: candidate.mealCount,
        mealStructure: candidate.mealStructure,
        reasoning: candidate.reasoning,
        weight: candidate.weight,
        estimatedTokens: candidate.estimatedTokens,
      })
      usedTokens += candidate.estimatedTokens
    } else {
      droppedForBudget.push({ slug: candidate.slug, estimatedTokens: candidate.estimatedTokens })
    }
  }

  return { examples, droppedForBudget }
}
