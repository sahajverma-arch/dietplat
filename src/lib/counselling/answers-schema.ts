import { z } from "zod"

import { missingRequired } from "./quick-intake"

/**
 * The 332-field bank has too much per-field shape variety (string, number,
 * array, nested mealVariants rows…) for a hand-typed Zod object to be worth
 * it, and every field's required-ness is already conditional logic living
 * in questions.ts (isQuestionRequired/isQuestionVisible). Duplicating that
 * into a second, parallel Zod shape is exactly the "hand-written twice" the
 * spec warns against — so the schema here is a thin Zod wrapper that calls
 * back into the question bank's own predicates via missingRequired().
 */
export function answersSchema(mode: "quick" | "full") {
  return z.record(z.string(), z.unknown()).superRefine((answers, ctx) => {
    for (const id of missingRequired(answers, mode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [id],
        message: "Required",
      })
    }
  })
}
