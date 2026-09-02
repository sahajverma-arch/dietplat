/**
 * There is no dietitian-confirmed fat_loss/muscle_gain/maintenance field
 * anywhere in the roadmap/counselling pipeline — this derives a proxy for
 * the Dietitian Knowledge RAG layer's retrieval filter only, from the
 * week's calorie-target direction vs. TDEE. Does not touch roadmap.ts or
 * the counselling engine. Accepted v1 simplification — see CLAUDE.md
 * "Dietitian knowledge layer".
 */

import type { RoadmapResult } from "@/lib/counselling/roadmap"
import { weekTargets } from "@/lib/counselling/roadmap"

export type InferredGoal = "fat_loss" | "muscle_gain" | "maintenance"

// 5% band around TDEE avoids flip-flopping the goal label from rounding
// noise near maintenance.
const GOAL_BAND = 0.05

export function inferGoalFromRoadmap(roadmap: RoadmapResult, weekNumber: number): InferredGoal {
  const weekKcal = weekTargets(roadmap, weekNumber).kcal
  const tdee = roadmap.energy.tdee
  if (weekKcal < tdee * (1 - GOAL_BAND)) return "fat_loss"
  if (weekKcal > tdee * (1 + GOAL_BAND)) return "muscle_gain"
  return "maintenance"
}
