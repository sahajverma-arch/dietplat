/**
 * Maps raw counselling Answers to the engine's RoadmapInput. Deliberately
 * separate from roadmap.ts: the engine itself is pure and knows nothing
 * about question ids, this file is the only place that translates between
 * the two.
 */

import type { ActivityLevel, Sex } from "./energy"
import type { Answers } from "./questions"
import type { Category } from "./types"
import type { CurrentIntake, RoadmapInput } from "./roadmap"

export class RoadmapInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RoadmapInputError"
  }
}

const CATEGORY_BY_ANSWER: Record<string, Category> = {
  "First-timer — never dieted with structure before": "first_timer",
  "Plateaued — dieting now, weight has stopped moving": "plateaued",
  "Re-starter — lost weight before and regained it": "re_starter",
  "Maintenance — at or near goal, holding it": "maintenance",
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  "Mostly seated",
  "Lightly active",
  "Moderately active",
  "Active",
  "Highly physical",
]

function requireNumber(answers: Answers, id: string, label: string): number {
  const value = answers[id]
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new RoadmapInputError(`${label} (${id}) is required to compute a roadmap and is missing or invalid.`)
  }
  return value
}

/**
 * Mifflin-St Jeor takes a binary sex term — "Other" / "Prefer not to say"
 * has no clinically defensible default, so this throws rather than guessing.
 */
function requireSex(answers: Answers): Sex {
  const gender = answers.gender
  if (gender === "Female") return "female"
  if (gender === "Male") return "male"
  throw new RoadmapInputError(
    `gender must be "Male" or "Female" to compute BMR (Mifflin-St Jeor requires a binary sex term); got ${JSON.stringify(gender)}.`
  )
}

function requireActivityLevel(answers: Answers): ActivityLevel {
  const value = answers.q54c
  if (typeof value === "string" && (ACTIVITY_LEVELS as string[]).includes(value)) {
    return value as ActivityLevel
  }
  throw new RoadmapInputError(`q54c (activity level) is required and must be one of ${ACTIVITY_LEVELS.join(", ")}.`)
}

function requireCategory(answers: Answers): Category {
  const value = answers.q76_category
  const mapped = typeof value === "string" ? CATEGORY_BY_ANSWER[value] : undefined
  if (!mapped) {
    throw new RoadmapInputError(`q76_category is required and must be one of the four counselling categories.`)
  }
  return mapped
}

/**
 * trainingDaysPerWeek defaults to 0 for "Variable" or an unanswered q44a —
 * the conservative choice (understating rather than overstating TDEE) when
 * a specific weekly frequency can't be pinned down.
 */
function trainingDaysPerWeek(answers: Answers): number {
  const value = answers.q44a
  const parsed = typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * currentIntake (q29b_est_kcal/protein_g/carbs_g/fat_g — see questions.ts's
 * top comment) only activates once protein, carbs and fat are ALL entered;
 * a partial fill of those three is treated the same as none, exactly like
 * an entirely-unanswered set. This is optional supplementary data, not a
 * required clinical gate — nothing throws, the roadmap just runs without
 * the current-intake-aware branches (already-below-target, chronic-under-
 * eating flag, protein ramp) the same way it always has when this wasn't
 * captured at all. What was/wasn't filled in is still visible on the
 * review page's raw answers, so nothing is hidden — it just doesn't feed
 * the engine half-complete.
 *
 * kcal itself is optional even when the other three are present: if
 * q29b_est_kcal was reported (full form), it's used as-is — a client's
 * self-reported daily-calorie estimate isn't required to exactly equal
 * protein×4 + carbs×4 + fat×9 (rounding, app-reported totals, etc., same
 * as any self-reported figure). If it wasn't asked at all (quick form only
 * asks protein/carbs/fat — see quick-intake.ts), kcal is computed from the
 * three macros via the same Atwater conversion CLAUDE.md already uses for
 * every food's exchange kcal ("THE ONE RULE THAT MATTERS" section), rather
 * than blocking the protein ramp on a fourth number the quick form was
 * deliberately built to avoid asking.
 */
function currentIntakeFromAnswers(answers: Answers): CurrentIntake | undefined {
  const proteinG = answers.q29b_est_protein_g
  const carbsG = answers.q29b_est_carbs_g
  const fatG = answers.q29b_est_fat_g

  if (
    typeof proteinG !== "number" ||
    typeof carbsG !== "number" ||
    typeof fatG !== "number" ||
    !Number.isFinite(proteinG) ||
    !Number.isFinite(carbsG) ||
    !Number.isFinite(fatG)
  ) {
    return undefined
  }

  const reportedKcal = answers.q29b_est_kcal
  const kcal = typeof reportedKcal === "number" && Number.isFinite(reportedKcal) ? reportedKcal : proteinG * 4 + carbsG * 4 + fatG * 9

  return { kcal, proteinG, carbsG, fatG }
}

export function roadmapInputFromAnswers(answers: Answers): RoadmapInput {
  return {
    ageYears: requireNumber(answers, "q9_age", "Age"),
    sex: requireSex(answers),
    heightCm: requireNumber(answers, "q9_height", "Height"),
    weightKg: requireNumber(answers, "q9_weight", "Weight"),
    activityLevel: requireActivityLevel(answers),
    trainingDaysPerWeek: trainingDaysPerWeek(answers),
    sessionIntensity: typeof answers.q44e === "string" ? answers.q44e : "Light",
    sessionDuration: typeof answers.q44b === "string" ? answers.q44b : "30–45 minutes",
    category: requireCategory(answers),
    currentIntake: currentIntakeFromAnswers(answers),
    weeksOnPlan: typeof answers.q76_weeks_on_plan === "number" ? answers.q76_weeks_on_plan : undefined,
    weeksStagnant: typeof answers.q76_weeks_stagnant === "number" ? answers.q76_weeks_stagnant : undefined,
  }
}
