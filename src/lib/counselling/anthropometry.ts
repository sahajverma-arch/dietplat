/**
 * BMI, target weight, and timeline. Source: Diet Engine Handbook v1.1 §2–3
 * and Worked Examples v1.2 §2.
 */

export type BmiClassification = "Underweight" | "Normal" | "Overweight" | "Obese"

export function bmi(weightKg: number, heightM: number): number {
  return weightKg / heightM ** 2
}

/**
 * Asian-Indian cut-offs (Indian Consensus Group 2009), not the WHO/Western
 * 25/30 cutoffs — BMI 26.8 or 28.9 correctly reads "Obese" here. The label
 * on the return value exists specifically so a reader never mistakes this
 * for a WHO-cutoff bug.
 */
export function classifyBmi(value: number): { classification: BmiClassification; criteria: "Indian consensus" } {
  let classification: BmiClassification
  if (value < 18.5) classification = "Underweight"
  else if (value < 23) classification = "Normal"
  else if (value < 25) classification = "Overweight"
  else classification = "Obese"
  return { classification, criteria: "Indian consensus" }
}

/** The middle of the healthy range, not its top — a target at 22.9 has no buffer against ordinary 1–2 kg water swings. */
export function targetWeight(heightM: number): number {
  return 21 * heightM ** 2
}

export function healthyRange(heightM: number): [number, number] {
  return [18.5 * heightM ** 2, 22.9 * heightM ** 2]
}

export function toLose(weightKg: number, targetKg: number): number {
  return Math.max(0, weightKg - targetKg)
}

export function firstMilestone(weightKg: number): number {
  return 0.05 * weightKg
}

export interface TimelineResult {
  fastestWeeks: number
  slowestWeeks: number
  /** Full-precision divisors for display — never round these to "÷ 0.7". */
  fastestDivisor: number
  slowestDivisor: number
}

/** Always a range — a point estimate lies. 1%–0.5% of body weight lost per week. */
export function timelineWeeks(toLoseKg: number, weightKg: number): TimelineResult {
  const fastestDivisor = weightKg * 0.01
  const slowestDivisor = weightKg * 0.005
  return {
    fastestWeeks: Math.ceil(toLoseKg / fastestDivisor),
    slowestWeeks: Math.ceil(toLoseKg / slowestDivisor),
    fastestDivisor,
    slowestDivisor,
  }
}
