/**
 * Macro allocation. Source: Diet Engine Handbook v1.1 §5, §9.
 * Allocation order is deliberate: protein and fat are requirements,
 * carbohydrate is what is left to spend on energy.
 */

import type { Category, RoadmapFlag } from "./types"

export const PROTEIN_BAND_BY_CATEGORY: Record<Category, number> = {
  first_timer: 1.35,
  plateaued: 1.9,
  re_starter: 1.9,
  maintenance: 1.5,
}

const CARB_FLOOR_G = 100 // ICMR-NIN minimum g/day

/**
 * Adjusted body weight applies at BMI ≥ 25 because adipose tissue is far
 * less protein-demanding than lean tissue; 0.25 is a clinical-nutrition
 * convention used when lean mass is unknown, not a measurement.
 */
export function dosingWeight(actualKg: number, targetKg: number, bmiValue: number): number {
  return bmiValue >= 25 ? targetKg + 0.25 * (actualKg - targetKg) : actualKg
}

export interface MacrosInput {
  kcal: number
  actualWeightKg: number
  targetWeightKg: number
  bmiValue: number
  category: Category
  /** A kidney/liver condition or recorded protein limit — protein is held at this exact figure and the band ignored. */
  proteinCapG?: number
}

export interface MacrosResult {
  dosingWeightKg: number
  proteinG: number
  /** g/kg actually used for the protein line — undefined when proteinHeld (the band was ignored). */
  proteinBandGPerKg?: number
  fatG: number
  /** Both fat candidates, so a display page can show `max(a, b)` without recomputing. */
  fatFromPercentG: number
  fatFromFloorG: number
  carbsG: number
  fibreG: number
  proteinHeld: boolean
  flags: RoadmapFlag[]
}

export function computeMacros(input: MacrosInput): MacrosResult {
  const flags: RoadmapFlag[] = []
  const weight = dosingWeight(input.actualWeightKg, input.targetWeightKg, input.bmiValue)

  const proteinHeld = input.proteinCapG !== undefined
  const proteinG = proteinHeld ? (input.proteinCapG as number) : PROTEIN_BAND_BY_CATEGORY[input.category] * weight
  if (proteinHeld) {
    flags.push({
      level: "warn",
      code: "protein-held",
      message: "A kidney/liver condition or recorded protein limit — protein held, ramp disabled.",
    })
  }

  const fatFromPercent = (0.25 * input.kcal) / 9
  const fatFromFloor = 0.7 * input.actualWeightKg
  const fatG = Math.max(fatFromPercent, fatFromFloor)
  if (fatFromFloor > fatFromPercent) {
    flags.push({
      level: "warn",
      code: "fat-floor",
      message: `Fat set by the 0.7 g/kg hormone floor (${fatFromFloor.toFixed(1)} g), not the 25% share (${fatFromPercent.toFixed(1)} g).`,
    })
  }

  const carbsG = (input.kcal - proteinG * 4 - fatG * 9) / 4
  if (carbsG < CARB_FLOOR_G) {
    flags.push({
      level: "warn",
      code: "carb-floor",
      message: `Carbohydrate (${carbsG.toFixed(0)} g) fell below the ICMR-NIN ${CARB_FLOOR_G} g/day minimum.`,
    })
  }

  const fibreG = clamp((input.kcal / 1000) * 15, 30, 45)

  return {
    dosingWeightKg: weight,
    proteinG,
    proteinBandGPerKg: proteinHeld ? undefined : PROTEIN_BAND_BY_CATEGORY[input.category],
    fatG,
    fatFromPercentG: fatFromPercent,
    fatFromFloorG: fatFromFloor,
    carbsG,
    fibreG,
    proteinHeld,
    flags,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
