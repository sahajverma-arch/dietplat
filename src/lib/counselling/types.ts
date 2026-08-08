/** Shared types for the deterministic diet engine. */

export type Category = "first_timer" | "plateaued" | "re_starter" | "maintenance"

export type FlagLevel = "warn" | "note" | "block" | "stop"

export interface RoadmapFlag {
  level: FlagLevel
  code: string
  message: string
}

export interface Macros {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fibreG: number
}
