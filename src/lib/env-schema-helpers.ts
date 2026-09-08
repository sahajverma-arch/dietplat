import { z } from "zod"

/**
 * An optional integer env var with a default, where a BLANK value means
 * "not set" rather than zero.
 *
 * Exists because `z.coerce.number().default(d)` gets this dangerously wrong:
 * `.default()` only fires for `undefined`, while an empty or whitespace-only
 * string coerces to `0`. A hosting dashboard makes blank values easy to
 * create — adding the variable and leaving the box empty is a normal thing
 * to do — so `RECIPE_BEST_OF_N=""` silently became 0, which is the escape
 * hatch that restores the old 19-22 call per-day-retry path. Cost and
 * behaviour both changed with no error anywhere. Confirmed against real Zod
 * behaviour, not assumed.
 *
 * A non-numeric value is still a hard boot failure — that is a typo worth
 * shouting about, unlike a blank.
 *
 * Lives outside env.ts so it can be unit-tested: env.ts validates real
 * server env at module load and throws, so it cannot be imported in a plain
 * Vitest run. Same separation as recipe-day-diagnosis.ts.
 */
export function optionalBoundedInt(defaultValue: number, min: number, max: number) {
  return z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? defaultValue : v.trim()))
    .pipe(z.coerce.number().int().min(min).max(max))
}
