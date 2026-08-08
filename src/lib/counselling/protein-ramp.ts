/**
 * The protein ramp. Source: Diet Engine Handbook v1.1 §6.
 * "ours — the companion is silent": this logic has no upstream citation,
 * it is this engine's own design. Applies to all four categories the same
 * way — the category sets the destination (target g), never the speed of
 * approach.
 */

export interface ProteinRampRow {
  week: number
  beforeG: number
  gapG: number
  stepG: number
  /** Literal, displayable formula text — the review page shows this as-is. */
  stepFormula: string
  afterG: number
}

const MAX_WEEKLY_STEP = 20
const CLOSE_OUT_THRESHOLD = 10

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * gap = target − current. step = min(gap × 0.25, 20 g), rounded to the
 * nearest 5 g, floored at 5 g. Recomputed each week against the gap that
 * REMAINS, so the steps taper. If the remaining gap is ≤ 10 g, it is closed
 * in a single final step instead — a step that would otherwise round to 0
 * closes the gap rather than stalling forever, and the last rung is always
 * exactly the target.
 */
export function proteinRamp(currentG: number, targetG: number): ProteinRampRow[] {
  const rows: ProteinRampRow[] = []
  let before = currentG
  let week = 1

  while (before < targetG) {
    const gap = targetG - before

    if (gap <= CLOSE_OUT_THRESHOLD) {
      const after = before + gap
      rows.push({
        week,
        beforeG: before,
        gapG: gap,
        stepG: gap,
        stepFormula: `gap ≤ 10 g → close-out: full ${round1(gap)} g`,
        afterG: after,
      })
      break
    }

    const rawStep = Math.min(gap * 0.25, MAX_WEEKLY_STEP)
    const step = Math.max(5, Math.round(rawStep / 5) * 5)
    const after = before + step
    rows.push({
      week,
      beforeG: before,
      gapG: gap,
      stepG: step,
      stepFormula: `min(${round1(gap)}×0.25, ${MAX_WEEKLY_STEP})=${round1(rawStep)} → ${step} g`,
      afterG: after,
    })

    before = after
    week += 1
  }

  return rows
}
