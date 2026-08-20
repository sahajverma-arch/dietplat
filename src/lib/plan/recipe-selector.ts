/**
 * Orchestrates recipe selection: (1) whole-week LLM attempt, up to 3
 * attempts with backoff, falling back to the deterministic selector after 3
 * straight failures (skipping phase 2 entirely — a model that failed 3x is
 * very likely unreachable); (2) per-day retry (LLM path only), up to
 * MAX_DAY_RETRIES=3, triggered by ANY of three independent checks failing —
 * macro tolerance, plausibility, or variety — each retry telling the model
 * exactly what's wrong; (3) an honest final gate: any day still failing
 * after every retry REJECTS THE WHOLE PLAN (no DB write), applying equally
 * to the deterministic fallback (unlike prior engines, there is no
 * LLM-only exemption here — see CLAUDE.md "The recipe engine").
 */

import { createNvidiaClient, NVIDIA_MODEL } from "./nvidia-client"
import { buildDayRetryMessages, buildInitialMessages, type PromptMessage } from "./recipe-prompt"
import { llmRecipeDaySchema, llmRecipeSelectionSchema } from "./recipe-schema"
import { buildRecipeIndex, groundSelection, type RecipeIndex } from "./recipe-grounding"
import { balanceDayToTargets } from "./recipe-balancer"
import { describeMacroProblems, isRecipeDayOffTarget, isRecipeWeekOffTarget } from "./recipe-validate"
import { describePlausibilityProblems, type ClientRecipeConstraints } from "./recipe-plausibility-validate"
import { findDaysNeedingVarietyRetry, findVarietyViolations, MAX_RECIPE_REPEATS_PER_WEEK } from "./recipe-variety-tracker"
import { recipeSelectorFallback } from "./recipe-selector-fallback"
import type { GroundedRecipeDay, GroundedRecipeSelection, RecipeAchievedMacros, RecipeSelection, RecipeSelectionResult, RecipeSelectorInput } from "./recipe-types"

const MAX_WEEK_ATTEMPTS = 3
const MAX_DAY_RETRIES = 3
const BASE_BACKOFF_MS = 500

export interface RecipeAttemptLog {
  attemptNumber: number
  dayIndex: number | null
  model: string | null
  promptHash: string
  rawResponse: string | null
  validationResult: { ok: boolean; errors: string[] }
  latencyMs: number
}

export interface SelectRecipesOptions {
  onAttempt?: (log: RecipeAttemptLog) => void
  maxWeekAttempts?: number
  maxDayRetries?: number
}

export class RecipeSelectionRejectedError extends Error {
  constructor(
    message: string,
    public readonly dayProblems: { dayIndex: number; problems: string[] }[]
  ) {
    super(message)
    this.name = "RecipeSelectionRejectedError"
  }
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash.toString(16)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response")
  return JSON.parse(raw.slice(start, end + 1))
}

function computeWeeklyAverage(days: GroundedRecipeDay[]): RecipeAchievedMacros {
  const n = days.length || 1
  return {
    kcal: days.reduce((s, d) => s + d.totals.kcal, 0) / n,
    proteinG: days.reduce((s, d) => s + d.totals.proteinG, 0) / n,
    carbsG: days.reduce((s, d) => s + d.totals.carbsG, 0) / n,
    fatG: days.reduce((s, d) => s + d.totals.fatG, 0) / n,
    fiberG: days.reduce((s, d) => s + d.totals.fiberG, 0) / n,
  }
}

function diagnoseDay(day: GroundedRecipeDay, input: RecipeSelectorInput, constraints: ClientRecipeConstraints, overusedRecipeNames: Set<string>): string[] {
  const problems = [
    ...describeMacroProblems(day.totals, input.dailyTarget),
    ...describePlausibilityProblems(day, constraints),
  ]
  if (day.unknownRecipeNames.length > 0) {
    problems.push(`Could not identify these recipe names, they were dropped: ${day.unknownRecipeNames.join(", ")}`)
  }
  if (day.cappedRecipeNames.length > 0) {
    problems.push(`These recipes hit their realistic serving limit without closing the gap — consider adding another dish instead: ${day.cappedRecipeNames.join(", ")}`)
  }
  for (const name of overusedRecipeNames) {
    if (day.meals.some((m) => m.items.some((i) => i.recipe.name === name))) {
      problems.push(`"${name}" has already been used more than ${MAX_RECIPE_REPEATS_PER_WEEK} times this week — choose a different recipe for this day.`)
    }
  }
  return problems
}

function dayNeedsRetry(day: GroundedRecipeDay, input: RecipeSelectorInput, constraints: ClientRecipeConstraints, daysNeedingVarietyRetry: Set<number>): boolean {
  return (
    isRecipeDayOffTarget(day.totals, input.dailyTarget) ||
    describePlausibilityProblems(day, constraints).length > 0 ||
    daysNeedingVarietyRetry.has(day.dayIndex) ||
    day.unknownRecipeNames.length > 0
  )
}

async function callModel(messages: PromptMessage[]): Promise<{ rawResponse: string | null; latencyMs: number }> {
  const client = createNvidiaClient()
  const startedAt = Date.now()
  const completion = await client.chat.completions.create({
    model: NVIDIA_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.3,
  })
  return { rawResponse: completion.choices[0]?.message?.content ?? null, latencyMs: Date.now() - startedAt }
}

async function runWholeWeekPhase(
  input: RecipeSelectorInput,
  index: RecipeIndex,
  maxAttempts: number,
  onAttempt?: (log: RecipeAttemptLog) => void
): Promise<{ grounded: GroundedRecipeSelection; generationMode: "ai" | "fallback"; modelUsed: string | null; attempts: number }> {
  const messages = buildInitialMessages(input)
  const promptHash = hashString(JSON.stringify(messages))

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    let rawResponse: string | null = null
    let latencyMs = 0
    let validationResult: { ok: boolean; errors: string[] } = { ok: false, errors: [] }

    try {
      const result = await callModel(messages)
      rawResponse = result.rawResponse
      latencyMs = result.latencyMs

      if (!rawResponse) {
        validationResult = { ok: false, errors: ["Model returned an empty response."] }
      } else {
        const parsed = llmRecipeSelectionSchema.parse(extractJson(rawResponse))
        const selection: RecipeSelection = parsed
        const grounded = groundSelection(selection, index)
        const balancedDays = grounded.days.map((day) => balanceDayToTargets(day, input.dailyTarget))
        validationResult = { ok: true, errors: [] }
        onAttempt?.({ attemptNumber, dayIndex: null, model: NVIDIA_MODEL, promptHash, rawResponse, validationResult, latencyMs })
        return { grounded: { days: balancedDays }, generationMode: "ai", modelUsed: NVIDIA_MODEL, attempts: attemptNumber }
      }
    } catch (err) {
      validationResult = { ok: false, errors: [err instanceof Error ? err.message : String(err)] }
    }

    onAttempt?.({ attemptNumber, dayIndex: null, model: NVIDIA_MODEL, promptHash, rawResponse, validationResult, latencyMs })

    if (attemptNumber < maxAttempts) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attemptNumber - 1))
    }
  }

  const fallbackSelected = recipeSelectorFallback(input)
  const grounded = groundSelection(fallbackSelected, index)
  const balancedDays = grounded.days.map((day) => balanceDayToTargets(day, input.dailyTarget))
  return { grounded: { days: balancedDays }, generationMode: "fallback", modelUsed: null, attempts: maxAttempts }
}

async function retryOneDay(
  input: RecipeSelectorInput,
  index: RecipeIndex,
  day: GroundedRecipeDay,
  diagnoses: string[],
  attemptNumber: number,
  onAttempt?: (log: RecipeAttemptLog) => void
): Promise<GroundedRecipeDay | null> {
  const messages = buildDayRetryMessages(input, day, diagnoses)
  const promptHash = hashString(JSON.stringify(messages))
  let rawResponse: string | null = null
  let latencyMs = 0
  let validationResult: { ok: boolean; errors: string[] } = { ok: false, errors: [] }

  try {
    const result = await callModel(messages)
    rawResponse = result.rawResponse
    latencyMs = result.latencyMs
    if (!rawResponse) {
      validationResult = { ok: false, errors: ["Model returned an empty response."] }
    } else {
      const parsedDay = llmRecipeDaySchema.parse(extractJson(rawResponse))
      const grounded = groundSelection({ days: [parsedDay] }, index)
      const balanced = balanceDayToTargets(grounded.days[0], input.dailyTarget)
      validationResult = { ok: true, errors: [] }
      onAttempt?.({ attemptNumber, dayIndex: day.dayIndex, model: NVIDIA_MODEL, promptHash, rawResponse, validationResult, latencyMs })
      return { ...balanced, dayIndex: day.dayIndex }
    }
  } catch (err) {
    validationResult = { ok: false, errors: [err instanceof Error ? err.message : String(err)] }
  }

  onAttempt?.({ attemptNumber, dayIndex: day.dayIndex, model: NVIDIA_MODEL, promptHash, rawResponse, validationResult, latencyMs })
  return null
}

export async function selectRecipes(
  input: RecipeSelectorInput,
  constraints: ClientRecipeConstraints,
  options: SelectRecipesOptions = {}
): Promise<RecipeSelectionResult> {
  const maxWeekAttempts = options.maxWeekAttempts ?? MAX_WEEK_ATTEMPTS
  const maxDayRetries = options.maxDayRetries ?? MAX_DAY_RETRIES
  const index = buildRecipeIndex([...input.allRecipesById.values()], input.aliasRows)

  const { grounded, generationMode, modelUsed, attempts } = await runWholeWeekPhase(input, index, maxWeekAttempts, options.onAttempt)
  let days = grounded.days

  // Per-day retry — LLM path only; the fallback path has no model to retry
  // with, so its days go straight to the final gate below.
  if (generationMode === "ai") {
    for (let round = 0; round < maxDayRetries; round++) {
      const daysNeedingVarietyRetry = findDaysNeedingVarietyRetry(days)
      const overused = new Set(findVarietyViolations(days).map((v) => v.name))
      const dayIndexesNeedingRetry = days.filter((d) => dayNeedsRetry(d, input, constraints, daysNeedingVarietyRetry)).map((d) => d.dayIndex)
      if (dayIndexesNeedingRetry.length === 0) break

      for (const dayIndex of dayIndexesNeedingRetry) {
        const day = days.find((d) => d.dayIndex === dayIndex)!
        const diagnoses = diagnoseDay(day, input, constraints, overused)
        const retried = await retryOneDay(input, index, day, diagnoses, round + 1, options.onAttempt)
        if (retried) days = days.map((d) => (d.dayIndex === dayIndex ? retried : d))
      }
    }
  }

  // Final, honest gate — applies identically to both generation modes, no
  // exemption for the fallback path (confirmed decision, a real ethos
  // change from both prior engines' "always succeeds" guarantee).
  const daysNeedingVarietyRetry = findDaysNeedingVarietyRetry(days)
  const overused = new Set(findVarietyViolations(days).map((v) => v.name))
  const dayProblems = days
    .map((day) => ({ dayIndex: day.dayIndex, problems: diagnoseDay(day, input, constraints, overused) }))
    .filter((d) => d.problems.length > 0 || daysNeedingVarietyRetry.has(d.dayIndex))

  const weeklyAverage = computeWeeklyAverage(days)
  const weekOffTarget = isRecipeWeekOffTarget(weeklyAverage, input.dailyTarget)

  if (dayProblems.length > 0 || weekOffTarget) {
    throw new RecipeSelectionRejectedError(
      `Recipe plan rejected: ${dayProblems.length} day(s) still failed validation after ${maxDayRetries} retries.`,
      dayProblems
    )
  }

  const warnings: string[] = []
  for (const day of days) {
    if (day.cappedRecipeNames.length > 0) warnings.push(`Day ${day.dayIndex}: recipes hit their serving limit: ${day.cappedRecipeNames.join(", ")}`)
  }

  return { selection: { days }, generationMode, modelUsed, attempts, warnings }
}
