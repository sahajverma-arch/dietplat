/**
 * Energy: BMR, per-session training cost, TDEE.
 * Source: Diet Engine Handbook v1.1 §1 + Worked Examples v1.2 §1 and the
 * reference tables on their final page. Every constant here is transcribed
 * from those documents, not derived.
 */

export type Sex = "male" | "female"

export type ActivityLevel =
  | "Mostly seated"
  | "Lightly active"
  | "Moderately active"
  | "Active"
  | "Highly physical"

export type SessionIntensity = "Very light" | "Light" | "Moderate" | "Hard" | "Very hard" | "Variable" | "Not sure"

export type SessionDuration =
  | "Less than 30 minutes"
  | "30–45 minutes"
  | "45–60 minutes"
  | "60–90 minutes"
  | "More than 90 minutes"
  | "Variable"

/**
 * NEAT-only multipliers — deliberately lower than classic Harris-style
 * activity factors, which bundle the thermic effect of food (TEF) in. TEF
 * is charged once, separately, as ×1.10 in tdee(). If a future revision
 * ever swaps in bundled activity factors, that ×1.10 step must be removed
 * at the same time, or TDEE double-counts TEF.
 */
export const NEAT_BY_ACTIVITY: Record<ActivityLevel, number> = {
  "Mostly seated": 1.2,
  "Lightly active": 1.35,
  "Moderately active": 1.45,
  Active: 1.55,
  "Highly physical": 1.7,
}

/** "Variable", "Not sure", or unanswered fall back to Light (MET 3) rather than erroring. */
export const MET_BY_INTENSITY: Record<string, number> = {
  "Very light": 2.5,
  Light: 3,
  Moderate: 5,
  Hard: 7,
  "Very hard": 9,
  Variable: 3,
  "Not sure": 3,
}

const DEFAULT_MET = 3

export function metFor(intensity: string | null | undefined): number {
  if (!intensity) return DEFAULT_MET
  return MET_BY_INTENSITY[intensity] ?? DEFAULT_MET
}

/**
 * Each figure is the midpoint of its band. "Variable" or no answer falls
 * back to 30–45 minutes (0.625 h).
 */
export const HOURS_BY_DURATION: Record<string, number> = {
  "Less than 30 minutes": 0.375,
  "30–45 minutes": 0.625,
  "45–60 minutes": 0.875,
  "60–90 minutes": 1.25,
  "More than 90 minutes": 1.75,
  Variable: 0.625,
}

const DEFAULT_HOURS = 0.625

export function hoursFor(duration: string | null | undefined): number {
  if (!duration) return DEFAULT_HOURS
  return HOURS_BY_DURATION[duration] ?? DEFAULT_HOURS
}

/**
 * Mifflin-St Jeor. Kept fully unrounded — verified against all four worked
 * examples that feeding the exact unrounded BMR forward (not the displayed
 * whole-kcal figure) is what reproduces the documented TDEE exactly. Round
 * only at display, per CLAUDE.md.
 */
export function bmr(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161)
}

/**
 * BMR × NEAT already pays for the resting hour a training session also
 * occupies. Subtracting 1 MET removes exactly that overlap, so the session
 * is charged for the EXTRA effort over resting, not the whole hour twice.
 * Kept fully unrounded for the same reason bmr() is.
 */
export function kcalPerSession(met: number, weightKg: number, hours: number): number {
  return (met - 1) * weightKg * hours
}

export interface TdeeInput {
  bmr: number
  neat: number
  trainingDaysPerWeek: number
  kcalPerSession: number
}

export interface TdeeResult {
  activityAndTraining: number
  tdee: number
}

const TEF_SHARE = 0.1

/** TEF is priced as 10% of the activity-and-training total (not of BMR alone) and added on top. */
export function tdee(input: TdeeInput): TdeeResult {
  const activityAndTraining = input.bmr * input.neat + (input.trainingDaysPerWeek * input.kcalPerSession) / 7
  return {
    activityAndTraining,
    tdee: activityAndTraining * (1 + TEF_SHARE),
  }
}
