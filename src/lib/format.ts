/**
 * Display-only rounding. Per CLAUDE.md: all intermediate maths stay
 * unrounded everywhere else — these are called exclusively when rendering.
 */

export function formatKcal(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return Math.round(value).toLocaleString("en-IN")
}

export function formatGrams(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return Math.round(value).toString()
}

export function formatBmi(value: number): string {
  return value.toFixed(1)
}

export function formatWeight(value: number): string {
  return value.toFixed(1)
}

/** Timeline divisors: full precision, never the "÷ 0.7" trap — 2 decimals, matching the worked-examples convention. */
export function formatDivisor(value: number): string {
  return value.toFixed(2)
}
