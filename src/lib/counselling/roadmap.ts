/**
 * roadmapFor() — composes energy.ts, anthropometry.ts, strategy.ts,
 * macros.ts and protein-ramp.ts into the full client roadmap, plus
 * weekTargets() for a specific week. Source: Diet Engine Handbook v1.1
 * (whole document) + Worked Examples v1.2 (all four categories, verified
 * line by line — see roadmap.test.ts).
 */

import {
  bmr,
  hoursFor,
  kcalPerSession,
  metFor,
  NEAT_BY_ACTIVITY,
  tdee,
  type ActivityLevel,
  type Sex,
} from "./energy"
import { bmi, classifyBmi, firstMilestone, healthyRange, targetWeight, timelineWeeks, toLose } from "./anthropometry"
import { calorieStrategy, type StrategyPhase } from "./strategy"
import { computeMacros, type MacrosResult } from "./macros"
import { proteinRamp, type ProteinRampRow } from "./protein-ramp"
import type { Category, Macros, RoadmapFlag } from "./types"

export const ENGINE_VERSION = "1.0.0"

const GOAL_CATEGORY_CONFLICT_THRESHOLD_KG = 5
const PROTEIN_WEEK1_FLOOR_G_PER_KG = 1.0

export interface CurrentIntake {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface RoadmapInput {
  ageYears: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  trainingDaysPerWeek: number
  sessionIntensity: string
  sessionDuration: string
  category: Category
  /**
   * Priced against the foods table (Table 4.1 exchange constants) — omit
   * when that pricing hasn't happened yet. The roadmap still computes, just
   * without the current-intake-aware branches (already-below-target,
   * adaptation tests, the reverse-diet trigger).
   */
  currentIntake?: CurrentIntake
  /** Category 2 only. */
  weeksOnPlan?: number
  /** Category 2 only. */
  weeksStagnant?: number
  /** A kidney/liver condition or recorded protein limit. */
  proteinCapG?: number
}

export interface EnergyBreakdown {
  bmr: number
  neat: number
  met: number
  hours: number
  kcalPerSession: number
  activityAndTraining: number
  tdee: number
}

export interface AnthroBreakdown {
  bmiValue: number
  classification: string
  criteria: "Indian consensus"
  targetWeightKg: number
  healthyRangeKg: [number, number]
  toLoseKg: number
  firstMilestoneKg: number
  fastestWeeks: number
  slowestWeeks: number
  fastestDivisor: number
  slowestDivisor: number
}

export interface Projection extends Macros {
  label: string
  weightKg: number
  proteinHeldOrGoalBand: number
}

export interface RoadmapResult {
  engineVersion: string
  energy: EnergyBreakdown
  anthro: AnthroBreakdown
  category: Category
  phases: StrategyPhase[]
  adapted?: boolean
  macrosAtTarget: MacrosResult & { kcal: number }
  proteinRamp: ProteinRampRow[]
  projection: Projection
  flags: RoadmapFlag[]
}

export type WeekTargets = Macros

export function roadmapFor(input: RoadmapInput): RoadmapResult {
  const flags: RoadmapFlag[] = []
  const heightM = input.heightCm / 100

  // --- 1. Energy ---------------------------------------------------------
  const bmrValue = bmr(input.weightKg, input.heightCm, input.ageYears, input.sex)
  const neat = NEAT_BY_ACTIVITY[input.activityLevel]
  const met = metFor(input.sessionIntensity)
  const hours = hoursFor(input.sessionDuration)
  const kcalSession = kcalPerSession(met, input.weightKg, hours)
  const tdeeResult = tdee({
    bmr: bmrValue,
    neat,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    kcalPerSession: kcalSession,
  })

  // --- 2. BMI, target weight, timeline ------------------------------------
  const bmiValue = bmi(input.weightKg, heightM)
  const { classification, criteria } = classifyBmi(bmiValue)
  const targetWeightKg = targetWeight(heightM)
  const healthyRangeKg = healthyRange(heightM)
  const toLoseKg = toLose(input.weightKg, targetWeightKg)
  const firstMilestoneKg = firstMilestone(input.weightKg)
  const timeline = timelineWeeks(toLoseKg, input.weightKg)

  // --- 3. Cross-cutting guardrails ----------------------------------------
  if (bmiValue < 18.5) {
    flags.push({
      level: "stop",
      code: "underweight",
      message: "BMI < 18.5. No weight-loss plan is issued; route to a senior dietitian.",
    })
  }
  if (tdeeResult.tdee < bmrValue) {
    flags.push({
      level: "stop",
      code: "tdee-below-bmr",
      message: "TDEE < BMR — physiologically impossible, so the activity multiplier is wrong.",
    })
  }
  if (input.currentIntake && input.currentIntake.kcal < bmrValue) {
    flags.push({
      level: "warn",
      code: "chronic-under-eating",
      message:
        "Reported intake is below BMR — real adaptation or substantial under-reporting either way.",
    })
  }
  if (input.category === "maintenance" && toLoseKg >= GOAL_CATEGORY_CONFLICT_THRESHOLD_KG) {
    flags.push({
      level: "block",
      code: "GOAL_CATEGORY_CONFLICT",
      message: `Category 4 (maintenance) selected but ${toLoseKg.toFixed(1)} kg still to lose. A maintenance intake will not produce that loss — this roadmap cannot render without an explicit dietitian override recorded in the database.`,
    })
  }

  // --- 4. Calorie strategy -------------------------------------------------
  const strategyResult = calorieStrategy({
    category: input.category,
    tdee: tdeeResult.tdee,
    bmr: bmrValue,
    currentIntakeKcal: input.currentIntake?.kcal,
    weeksOnPlan: input.weeksOnPlan,
    weeksStagnant: input.weeksStagnant,
  })
  flags.push(...strategyResult.flags)

  // BMR clamp — no target ever goes below BMR.
  let clampedAnyPhase = false
  const phases = strategyResult.phases.map((phase) => {
    if (phase.kcal !== null && phase.kcal < bmrValue) {
      clampedAnyPhase = true
      return { ...phase, kcal: bmrValue }
    }
    return phase
  })
  if (clampedAnyPhase) {
    flags.push({
      level: "warn",
      code: "bmr-floor",
      message: "A computed target fell below BMR and was clamped to it.",
    })
  }

  // --- 5. Macros at target ---------------------------------------------------
  const targetPhase = [...phases].reverse().find((p) => p.kcal !== null)
  const targetKcal = targetPhase?.kcal ?? tdeeResult.tdee
  const macrosResult = computeMacros({
    kcal: targetKcal,
    actualWeightKg: input.weightKg,
    targetWeightKg,
    bmiValue,
    category: input.category,
    proteinCapG: input.proteinCapG,
  })
  flags.push(...macrosResult.flags)
  const macrosAtTarget = { ...macrosResult, kcal: targetKcal }

  // --- 6. Protein ramp ---------------------------------------------------
  const ramp =
    !macrosResult.proteinHeld && input.currentIntake && input.currentIntake.proteinG < macrosResult.proteinG
      ? proteinRamp(input.currentIntake.proteinG, macrosResult.proteinG)
      : []

  const week1ProteinG = ramp.length > 0 ? ramp[0].afterG : macrosResult.proteinG
  if (week1ProteinG / macrosResult.dosingWeightKg < PROTEIN_WEEK1_FLOOR_G_PER_KG) {
    flags.push({
      level: "warn",
      code: "PROTEIN_WEEK1_BELOW_FLOOR",
      message: `Week-1 ramped protein (${week1ProteinG.toFixed(1)} g) is below 1.0 g/kg of dosing weight (${macrosResult.dosingWeightKg.toFixed(1)} kg).`,
    })
  }

  // --- 7. Projection -------------------------------------------------------
  // Category 4: the goal-weight projection is suppressed — a reverse diet
  // targets maintenance at CURRENT weight, so projecting to a lower "goal"
  // would contradict the strategy. Project at current weight instead.
  const projection: Projection =
    input.category === "maintenance"
      ? {
          label: "At maintenance (current weight)",
          weightKg: input.weightKg,
          kcal: targetKcal,
          proteinG: macrosResult.proteinG,
          fatG: macrosResult.fatG,
          carbsG: macrosResult.carbsG,
          fibreG: macrosResult.fibreG,
          proteinHeldOrGoalBand: macrosResult.proteinG / macrosResult.dosingWeightKg,
        }
      : projectAtGoalWeight(input, targetWeightKg, neat, met, hours)

  return {
    engineVersion: ENGINE_VERSION,
    energy: {
      bmr: bmrValue,
      neat,
      met,
      hours,
      kcalPerSession: kcalSession,
      activityAndTraining: tdeeResult.activityAndTraining,
      tdee: tdeeResult.tdee,
    },
    anthro: {
      bmiValue,
      classification,
      criteria,
      targetWeightKg,
      healthyRangeKg,
      toLoseKg,
      firstMilestoneKg,
      fastestWeeks: timeline.fastestWeeks,
      slowestWeeks: timeline.slowestWeeks,
      fastestDivisor: timeline.fastestDivisor,
      slowestDivisor: timeline.slowestDivisor,
    },
    category: input.category,
    phases,
    adapted: strategyResult.adapted,
    macrosAtTarget,
    proteinRamp: ramp,
    projection,
    flags,
  }
}

const MAINTENANCE_PROTEIN_BAND = 1.5

/**
 * The projection recomputes BMR/TDEE at the goal weight (same activity,
 * training, intensity, duration inputs) and switches to the maintenance
 * protein band regardless of the client's original category — "at goal"
 * means "now at maintenance". Verified against all three non-maintenance
 * worked examples (Priya, Sneha, Rahul) — see roadmap.test.ts.
 */
function projectAtGoalWeight(
  input: RoadmapInput,
  targetWeightKg: number,
  neat: number,
  met: number,
  hours: number
): Projection {
  const bmrGoal = bmr(targetWeightKg, input.heightCm, input.ageYears, input.sex)
  const kcalSessionGoal = kcalPerSession(met, targetWeightKg, hours)
  const tdeeGoal = tdee({
    bmr: bmrGoal,
    neat,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    kcalPerSession: kcalSessionGoal,
  }).tdee

  const proteinGoal = MAINTENANCE_PROTEIN_BAND * targetWeightKg
  const fatGoal = Math.max((0.25 * tdeeGoal) / 9, 0.7 * targetWeightKg)
  const carbsGoal = (tdeeGoal - proteinGoal * 4 - fatGoal * 9) / 4
  const fibreGoal = Math.min(Math.max((tdeeGoal / 1000) * 15, 30), 45)

  return {
    label: "At goal weight",
    weightKg: targetWeightKg,
    kcal: tdeeGoal,
    proteinG: proteinGoal,
    fatG: fatGoal,
    carbsG: carbsGoal,
    fibreG: fibreGoal,
    proteinHeldOrGoalBand: MAINTENANCE_PROTEIN_BAND,
  }
}

/**
 * kcal from the strategy phase covering that week, protein from the ramp
 * row, fat fixed at the steady-state figure, carbs recomputed as the
 * residual AT THAT WEEK'S kcal AND PROTEIN — never the at-target carbs.
 */
export function weekTargets(roadmap: RoadmapResult, weekNumber: number): WeekTargets {
  const matches = roadmap.phases.filter(
    (p) => weekNumber >= p.weekFrom && (p.weekTo === null || weekNumber <= p.weekTo)
  )
  const withKcal = matches.filter((p) => p.kcal !== null)
  const phase = withKcal.length > 0 ? withKcal[withKcal.length - 1] : matches[matches.length - 1]
  const kcal = phase?.kcal ?? roadmap.macrosAtTarget.kcal

  const rampRow = roadmap.proteinRamp.find((r) => r.week === weekNumber)
  const proteinG =
    roadmap.proteinRamp.length === 0
      ? roadmap.macrosAtTarget.proteinG
      : (rampRow ?? roadmap.proteinRamp[roadmap.proteinRamp.length - 1]).afterG

  const fatG = roadmap.macrosAtTarget.fatG
  const carbsG = (kcal - proteinG * 4 - fatG * 9) / 4
  const fibreG = roadmap.macrosAtTarget.fibreG

  return { kcal, proteinG, fatG, carbsG, fibreG }
}
