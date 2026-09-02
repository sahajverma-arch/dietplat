import { describe, expect, it } from "vitest"

import type { RoadmapResult } from "@/lib/counselling/roadmap"

import { inferGoalFromRoadmap } from "./goal-inference"

/** Minimal-but-complete RoadmapResult fixture — only `energy.tdee`, `phases`, `proteinRamp`, and `macrosAtTarget` are read by weekTargets()/inferGoalFromRoadmap(); everything else is a plausible placeholder. */
function makeRoadmap(overrides: { tdee: number; weekKcal: number }): RoadmapResult {
  return {
    engineVersion: "test",
    energy: { bmr: 1400, neat: 400, met: 3, hours: 0.5, kcalPerSession: 100, activityAndTraining: 500, tdee: overrides.tdee },
    anthro: {
      bmiValue: 25,
      classification: "Normal",
      criteria: "Indian consensus",
      targetWeightKg: 60,
      healthyRangeKg: [55, 65],
      toLoseKg: 5,
      firstMilestoneKg: 1,
      fastestWeeks: 10,
      slowestWeeks: 20,
      fastestDivisor: 0.8,
      slowestDivisor: 0.5,
    },
    category: "first_timer",
    phases: [{ label: "Test phase", weekFrom: 1, weekTo: null, kcal: overrides.weekKcal, why: "test" }],
    macrosAtTarget: {
      dosingWeightKg: 60,
      proteinG: 80,
      proteinBandGPerKg: 1.3,
      fatG: 55,
      fatFromPercentG: 50,
      fatFromFloorG: 55,
      carbsG: 200,
      fibreG: 30,
      proteinHeld: false,
      flags: [],
      kcal: overrides.weekKcal,
    },
    proteinRamp: [],
    projection: { label: "test", weightKg: 60, proteinHeldOrGoalBand: 1.3, kcal: overrides.weekKcal, proteinG: 80, fatG: 55, carbsG: 200, fibreG: 30 },
    flags: [],
  }
}

describe("inferGoalFromRoadmap", () => {
  it("returns fat_loss when the week's kcal target is well under TDEE", () => {
    const roadmap = makeRoadmap({ tdee: 2200, weekKcal: 1775 })
    expect(inferGoalFromRoadmap(roadmap, 1)).toBe("fat_loss")
  })

  it("returns muscle_gain when the week's kcal target is well over TDEE", () => {
    const roadmap = makeRoadmap({ tdee: 2200, weekKcal: 2600 })
    expect(inferGoalFromRoadmap(roadmap, 1)).toBe("muscle_gain")
  })

  it("returns maintenance when the week's kcal target is within the 5% band of TDEE", () => {
    const roadmap = makeRoadmap({ tdee: 2200, weekKcal: 2200 })
    expect(inferGoalFromRoadmap(roadmap, 1)).toBe("maintenance")
  })

  it("does not flip to fat_loss/muscle_gain right at the edge of the band", () => {
    const roadmap = makeRoadmap({ tdee: 2000, weekKcal: 2000 * 1.049 })
    expect(inferGoalFromRoadmap(roadmap, 1)).toBe("maintenance")
  })
})
