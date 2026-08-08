/**
 * Table 4.1 — Comprehensive Food Exchange List (Indian modified American
 * exchange list), inlined so the solver is pure arithmetic with zero round
 * trips (same pattern as the sister codebase's exchange-plan.ts). MUST stay
 * in sync with the exchange_types migration
 * (20260808200000_classic_table41_exchange_system.sql) and seed — these are
 * the same 11 rows, protein_g/carbs_g/fat_g exactly as seeded, kcal
 * computed the same way (protein*4 + carbs*4 + fat*9), never sourced
 * independently.
 */

export type ExchangeCode =
  | "milk_cow"
  | "milk_skim"
  | "meat"
  | "meat_lean"
  | "pulse"
  | "cereal"
  | "vegetable_a"
  | "vegetable_b"
  | "fruit"
  | "fat"
  | "sugar"

export interface ExchangeMacros {
  proteinG: number
  carbsG: number
  fatG: number
  kcal: number
}

function anchor(proteinG: number, carbsG: number, fatG: number): ExchangeMacros {
  return { proteinG, carbsG, fatG, kcal: proteinG * 4 + carbsG * 4 + fatG * 9 }
}

export const TABLE_4_1: Record<ExchangeCode, ExchangeMacros> = {
  milk_cow: anchor(8, 12, 10),
  milk_skim: anchor(8, 14.7, 0),
  meat: anchor(7, 0, 6),
  meat_lean: anchor(7, 0, 0.5),
  pulse: anchor(7, 17, 0),
  cereal: anchor(2, 15, 0),
  vegetable_a: anchor(1, 3.5, 0),
  vegetable_b: anchor(2, 7, 0),
  fruit: anchor(0, 10, 0),
  fat: anchor(0, 0, 5),
  sugar: anchor(0, 5, 0),
}

export type ExchangeCounts = Record<ExchangeCode, number>

export const ZERO_COUNTS: ExchangeCounts = {
  milk_cow: 0,
  milk_skim: 0,
  meat: 0,
  meat_lean: 0,
  pulse: 0,
  cereal: 0,
  vegetable_a: 0,
  vegetable_b: 0,
  fruit: 0,
  fat: 0,
  sugar: 0,
}

export interface AchievedMacros {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export function sumExchanges(counts: ExchangeCounts): AchievedMacros {
  let kcal = 0
  let proteinG = 0
  let carbsG = 0
  let fatG = 0
  for (const code of Object.keys(counts) as ExchangeCode[]) {
    const n = counts[code]
    if (!n) continue
    const x = TABLE_4_1[code]
    kcal += x.kcal * n
    proteinG += x.proteinG * n
    carbsG += x.carbsG * n
    fatG += x.fatG * n
  }
  return { kcal, proteinG, carbsG, fatG }
}
