/**
 * Quick Counselling — a curated subset of the shared 332-question bank
 * (questions.ts), not a separate bank. Source: the client's exported
 * quick-counselling-questions.pdf, "8 groups · 30 questions asked".
 *
 * Deliberate addition beyond the PDF: the "current_intake" group (3
 * questions, reusing q29b_est_protein_g/carbs_g/fat_g from the full-form
 * bank) isn't in the PDF's 30. Without it, roadmapInputFromAnswers() had no
 * currentIntake to build for any quick-counselled client, silently
 * disabling the protein ramp and multi-week calorie projection for them —
 * the same gap already fixed for the full form (see questions.ts's own
 * "Deliberate addition" comment). kcal isn't asked here; it's derived from
 * the three macros (see roadmap-input.ts's currentIntakeFromAnswers).
 */

import { type Answers, findQuestion, isQuestionRequired, isQuestionVisible, QUESTIONS } from "./questions"

export interface QuickGroup {
  id: string
  title: string
  questionIds: string[]
  intro?: string
}

export const QUICK_GROUPS: QuickGroup[] = [
  {
    id: "client",
    title: "Client details",
    questionIds: ["name", "gender", "phone", "q9_age", "q9_height", "q9_weight"],
  },
  {
    id: "goal",
    title: "Goal & roadmap category",
    questionIds: ["q2", "q76_category", "q76_weeks_on_plan", "q76_weeks_stagnant"],
    intro:
      "The roadmap category is the one judgement call this form can't skip — without it, week-1 calorie and protein targets can't be computed.",
  },
  {
    id: "activity",
    title: "Activity & training",
    questionIds: ["q54c", "q43", "q44a", "q44b", "q44e", "q44d"],
  },
  {
    id: "diet_safety",
    title: "Diet type & food safety",
    questionIds: ["q33", "q27", "q27c", "q36", "q35"],
    intro:
      "Every food picked below is treated as a strict allergy (never served) — the quick form doesn't distinguish allergy from milder intolerance. Use the full counselling form if that distinction matters for this client.",
  },
  {
    id: "cuisine",
    title: "Cuisine / region",
    questionIds: ["q34"],
  },
  {
    id: "meal_pattern",
    title: "Meal pattern",
    questionIds: ["q28"],
  },
  {
    id: "day_rules",
    title: "Day-specific food rules",
    questionIds: ["q38", "q38a", "q38b", "q38c"],
    intro:
      'Only needed if something changes on specific weekdays (no non-veg Tuesdays, a weekly fast, etc.) — otherwise leave at "No restriction".',
  },
  {
    id: "medical",
    title: "Medical",
    questionIds: ["q17", "q19", "q19a"],
  },
  {
    id: "current_intake",
    title: "Current intake",
    questionIds: ["q29b_est_protein_g", "q29b_est_carbs_g", "q29b_est_fat_g"],
    intro:
      "Not in the original quick-counselling PDF — added so quick sessions get a protein ramp and multi-week calorie projection too, same as the full form. Estimated calories are computed from these three (protein×4 + carbs×4 + fat×9), not asked separately. Leave all three blank if you can't estimate — the roadmap runs without the ramp, exactly as before.",
  },
]

export const QUICK_ASKED_IDS = new Set(QUICK_GROUPS.flatMap((g) => g.questionIds))

/** The sentinel written for every required full-form question the quick form doesn't ask. */
export const UNCOLLECTED_SENTINEL = "Not collected — quick intake"

/**
 * Every full-form question with a static `required: true` that the quick
 * form never presents. Computed from the bank rather than hand-listed, so it
 * can never drift from the actual quick groups above.
 */
export function unaskedRequiredQuestions() {
  return QUESTIONS.filter((q) => q.required && !QUICK_ASKED_IDS.has(q.id))
}

/**
 * On quick-form submit: answer every required-but-unasked full-form question
 * with the sentinel, so missingRequired() still passes the shared generation
 * gate. Never call this for the full form — it would paper over real gaps.
 */
export function fillUnaskedRequired(answers: Answers): Answers {
  const filled: Answers = { ...answers }
  for (const q of unaskedRequiredQuestions()) {
    if (filled[q.id] === undefined || filled[q.id] === null || filled[q.id] === "") {
      filled[q.id] = UNCOLLECTED_SENTINEL
    }
  }
  return filled
}

/** Strip sentinel values back out before displaying answers anywhere — they are not real clinical data. */
export function stripSentinelFields(answers: Answers): Answers {
  const stripped: Answers = {}
  for (const [id, value] of Object.entries(answers)) {
    if (value !== UNCOLLECTED_SENTINEL) stripped[id] = value
  }
  return stripped
}

export function isEmpty(value: unknown) {
  if (value === undefined || value === null || value === "") return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * Ids of required, currently-visible questions with no answer yet.
 * - "quick": only checks the 30 ids the quick form actually presents — the
 *   41 required-but-unasked ids are handled by fillUnaskedRequired() instead
 *   and must never block quick submission.
 * - "full": checks every required-or-requiredIf question in the whole bank.
 */
export function missingRequired(answers: Answers, mode: "quick" | "full"): string[] {
  const pool = mode === "quick" ? QUESTIONS.filter((q) => QUICK_ASKED_IDS.has(q.id)) : QUESTIONS
  return pool
    .filter((q) => isQuestionVisible(q, answers) && isQuestionRequired(q, answers))
    .filter((q) => isEmpty(answers[q.id]))
    .map((q) => q.id)
}

export { findQuestion }
