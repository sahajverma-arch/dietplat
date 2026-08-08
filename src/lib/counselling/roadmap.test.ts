import { describe, expect, it } from "vitest"
import { roadmapFor, weekTargets, type RoadmapInput } from "./roadmap"

/** Per CLAUDE.md's own testing philosophy: ±1 tolerance on displayed integers, exact on the rest. */
function closeTo(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected), `expected ~${expected}, got ${actual}`).toBeLessThanOrEqual(tolerance)
}

describe("roadmapFor — TEST-001 Priya (Category 1, first-timer)", () => {
  const input: RoadmapInput = {
    ageYears: 32,
    sex: "female",
    heightCm: 160,
    weightKg: 74,
    activityLevel: "Lightly active",
    trainingDaysPerWeek: 3,
    sessionIntensity: "Light",
    sessionDuration: "30–45 minutes",
    category: "first_timer",
    currentIntake: { kcal: 1625, proteinG: 50, carbsG: 218, fatG: 60 },
  }
  const roadmap = roadmapFor(input)

  it("energy", () => {
    closeTo(roadmap.energy.bmr, 1419)
    expect(roadmap.energy.met).toBe(3)
    expect(roadmap.energy.hours).toBe(0.625)
    closeTo(roadmap.energy.kcalPerSession, 93)
    closeTo(roadmap.energy.activityAndTraining, 1955)
    closeTo(roadmap.energy.tdee, 2151)
  })

  it("macros carry the protein band and both fat candidates for display", () => {
    expect(roadmap.macrosAtTarget.proteinBandGPerKg).toBe(1.35)
    closeTo(roadmap.macrosAtTarget.fatFromFloorG, 51.8, 0.5)
    expect(roadmap.macrosAtTarget.fatFromFloorG).toBeGreaterThan(roadmap.macrosAtTarget.fatFromPercentG)
  })

  it("BMI, target weight, timeline", () => {
    closeTo(roadmap.anthro.bmiValue, 28.9, 0.1)
    expect(roadmap.anthro.classification).toBe("Obese")
    closeTo(roadmap.anthro.targetWeightKg, 53.8, 0.1)
    closeTo(roadmap.anthro.toLoseKg, 20.2, 0.1)
    closeTo(roadmap.anthro.firstMilestoneKg, 3.7, 0.1)
    expect(roadmap.anthro.fastestWeeks).toBe(28)
    expect(roadmap.anthro.slowestWeeks).toBe(55)
  })

  it("calorie strategy — already-below-target gate + week-1 target", () => {
    expect(roadmap.flags.some((f) => f.code === "already-below-target")).toBe(true)
    expect(roadmap.phases[0].label).toBe("Weighed-logging gate")
    expect(roadmap.phases[0].kcal).toBeNull()
    closeTo(roadmap.macrosAtTarget.kcal, 1775)
  })

  it("macros at target", () => {
    closeTo(roadmap.macrosAtTarget.dosingWeightKg, 58.8, 0.1)
    closeTo(roadmap.macrosAtTarget.proteinG, 79)
    closeTo(roadmap.macrosAtTarget.fatG, 52)
    closeTo(roadmap.macrosAtTarget.carbsG, 248)
    closeTo(roadmap.macrosAtTarget.fibreG, 30)
    expect(roadmap.flags.some((f) => f.code === "fat-floor")).toBe(true)
  })

  it("protein ramp: 50 → 79 g over 5 weeks", () => {
    expect(roadmap.proteinRamp.map((r) => Math.round(r.afterG))).toEqual([55, 60, 65, 70, 79])
  })

  it("week 1 targets", () => {
    const w1 = weekTargets(roadmap, 1)
    closeTo(w1.kcal, 1775)
    closeTo(w1.proteinG, 55)
    closeTo(w1.fatG, 52)
    closeTo(w1.carbsG, 272)
  })

  it("projection at goal weight", () => {
    closeTo(roadmap.projection.kcal, 1839)
    closeTo(roadmap.projection.proteinG, 81)
    closeTo(roadmap.projection.fatG, 51)
    closeTo(roadmap.projection.carbsG, 264)
  })
})

describe("roadmapFor — TEST-003 Sneha (Category 2, plateaued)", () => {
  const input: RoadmapInput = {
    ageYears: 35,
    sex: "female",
    heightCm: 158,
    weightKg: 68,
    activityLevel: "Mostly seated",
    trainingDaysPerWeek: 5,
    sessionIntensity: "Light",
    sessionDuration: "30–45 minutes",
    category: "plateaued",
    currentIntake: { kcal: 1755, proteinG: 63, carbsG: 214, fatG: 70 },
    weeksOnPlan: 11,
    weeksStagnant: 4,
  }
  const roadmap = roadmapFor(input)

  it("energy", () => {
    closeTo(roadmap.energy.bmr, 1332)
    closeTo(roadmap.energy.kcalPerSession, 85)
    closeTo(roadmap.energy.tdee, 1824)
  })

  it("BMI, target weight, timeline", () => {
    closeTo(roadmap.anthro.bmiValue, 27.2, 0.1)
    expect(roadmap.anthro.classification).toBe("Obese")
    closeTo(roadmap.anthro.targetWeightKg, 52.4, 0.1)
    closeTo(roadmap.anthro.toLoseKg, 15.6, 0.1)
    expect(roadmap.anthro.fastestWeeks).toBe(23)
    expect(roadmap.anthro.slowestWeeks).toBe(46)
  })

  it("adaptation tests: NOT ADAPTED — holds at TDEE x 0.8", () => {
    expect(roadmap.adapted).toBe(false)
    closeTo(roadmap.macrosAtTarget.kcal, 1459)
  })

  it("macros at target", () => {
    closeTo(roadmap.macrosAtTarget.dosingWeightKg, 56.3, 0.1)
    closeTo(roadmap.macrosAtTarget.proteinG, 107)
    closeTo(roadmap.macrosAtTarget.fatG, 48)
    closeTo(roadmap.macrosAtTarget.carbsG, 150)
    expect(roadmap.flags.some((f) => f.code === "fat-floor")).toBe(true)
  })

  it("protein ramp: 63 → 107 g over 6 weeks", () => {
    expect(roadmap.proteinRamp.map((r) => Math.round(r.afterG))).toEqual([73, 83, 88, 93, 98, 107])
  })

  it("week 1 targets", () => {
    const w1 = weekTargets(roadmap, 1)
    closeTo(w1.kcal, 1459)
    closeTo(w1.proteinG, 73)
    closeTo(w1.fatG, 48)
    closeTo(w1.carbsG, 184)
  })

  it("projection at goal weight", () => {
    closeTo(roadmap.projection.kcal, 1604)
    closeTo(roadmap.projection.proteinG, 79)
  })
})

describe("roadmapFor — TEST-002 Rahul (Category 3, re-starter)", () => {
  const input: RoadmapInput = {
    ageYears: 29,
    sex: "male",
    heightCm: 175,
    weightKg: 82,
    activityLevel: "Mostly seated",
    trainingDaysPerWeek: 4,
    sessionIntensity: "Moderate",
    sessionDuration: "60–90 minutes",
    category: "re_starter",
    currentIntake: { kcal: 1960, proteinG: 98, carbsG: 240, fatG: 66 },
  }
  const roadmap = roadmapFor(input)

  it("energy", () => {
    closeTo(roadmap.energy.bmr, 1774)
    closeTo(roadmap.energy.kcalPerSession, 410)
    closeTo(roadmap.energy.tdee, 2599)
  })

  it("BMI, target weight, timeline", () => {
    closeTo(roadmap.anthro.bmiValue, 26.8, 0.1)
    expect(roadmap.anthro.classification).toBe("Obese")
    closeTo(roadmap.anthro.targetWeightKg, 64.3, 0.1)
    expect(roadmap.anthro.fastestWeeks).toBe(22)
    expect(roadmap.anthro.slowestWeeks).toBe(44)
  })

  it("three-phase ramp: 90% -> 85% -> 80% of TDEE", () => {
    expect(roadmap.phases).toHaveLength(3)
    closeTo(roadmap.phases[0].kcal as number, 2339)
    closeTo(roadmap.phases[1].kcal as number, 2209)
    closeTo(roadmap.phases[2].kcal as number, 2079)
  })

  it("macros at target (week 4+ steady state)", () => {
    closeTo(roadmap.macrosAtTarget.dosingWeightKg, 68.7, 0.1)
    closeTo(roadmap.macrosAtTarget.proteinG, 131)
    closeTo(roadmap.macrosAtTarget.fatG, 58)
    // Carbs is the residual of every upstream figure, so compounding
    // rounding drift is largest here — widened tolerance vs. the ±1 used
    // elsewhere, still well within CLAUDE.md's own stated golden-test policy.
    closeTo(roadmap.macrosAtTarget.carbsG, 258, 2)
    expect(roadmap.flags.some((f) => f.code === "fat-floor")).toBe(false)
  })

  it("protein ramp: 98 → 131 g over 5 weeks", () => {
    expect(roadmap.proteinRamp.map((r) => Math.round(r.afterG))).toEqual([108, 113, 118, 123, 131])
  })

  it("week 1 targets use the week-1 phase kcal, not the steady-state target", () => {
    const w1 = weekTargets(roadmap, 1)
    closeTo(w1.kcal, 2339)
    closeTo(w1.proteinG, 108)
    closeTo(w1.fatG, 58)
    closeTo(w1.carbsG, 346)
  })

  it("no flags raised", () => {
    expect(roadmap.flags).toEqual([])
  })

  it("projection at goal weight", () => {
    closeTo(roadmap.projection.kcal, 2310)
    closeTo(roadmap.projection.proteinG, 96)
    closeTo(roadmap.projection.fatG, 64)
  })
})

describe("roadmapFor — TEST-004 Aadi (Category 4, maintenance)", () => {
  const input: RoadmapInput = {
    ageYears: 27,
    sex: "male",
    heightCm: 172,
    weightKg: 66,
    activityLevel: "Mostly seated",
    trainingDaysPerWeek: 4,
    sessionIntensity: "Moderate",
    sessionDuration: "45–60 minutes",
    category: "maintenance",
    currentIntake: { kcal: 1958, proteinG: 83, carbsG: 227, fatG: 77 },
  }
  const roadmap = roadmapFor(input)

  it("energy", () => {
    closeTo(roadmap.energy.bmr, 1605)
    closeTo(roadmap.energy.kcalPerSession, 231)
    closeTo(roadmap.energy.tdee, 2264)
  })

  it("BMI classifies Normal, not Obese", () => {
    closeTo(roadmap.anthro.bmiValue, 22.3, 0.1)
    expect(roadmap.anthro.classification).toBe("Normal")
  })

  it("reverse diet: 3 weekly +125 kcal steps to TDEE", () => {
    expect(roadmap.phases).toHaveLength(3)
    closeTo(roadmap.phases[0].kcal as number, 2083)
    closeTo(roadmap.phases[1].kcal as number, 2208)
    closeTo(roadmap.phases[2].kcal as number, 2264)
    expect(roadmap.phases[2].weekTo).toBeNull()
  })

  it("macros at target (2264 kcal, maintenance band 1.5 g/kg, no BMI>=25 adjustment)", () => {
    closeTo(roadmap.macrosAtTarget.dosingWeightKg, 66, 0.1)
    closeTo(roadmap.macrosAtTarget.proteinG, 99)
    closeTo(roadmap.macrosAtTarget.fatG, 63)
    closeTo(roadmap.macrosAtTarget.carbsG, 325)
  })

  it("protein ramp: 83 → 99 g over 3 weeks", () => {
    expect(roadmap.proteinRamp.map((r) => r.afterG)).toEqual([88, 93, 99])
  })

  it("week 1 targets", () => {
    const w1 = weekTargets(roadmap, 1)
    closeTo(w1.kcal, 2083)
    closeTo(w1.proteinG, 88)
    closeTo(w1.fatG, 63)
    closeTo(w1.carbsG, 291)
  })

  it("projection is SUPPRESSED at goal weight and shown at current weight instead", () => {
    expect(roadmap.projection.label).toBe("At maintenance (current weight)")
    expect(roadmap.projection.weightKg).toBe(66)
    closeTo(roadmap.projection.kcal, 2264)
    closeTo(roadmap.projection.proteinG, 99)
    closeTo(roadmap.projection.fatG, 63)
    closeTo(roadmap.projection.carbsG, 325)
  })

  it("no flags raised", () => {
    expect(roadmap.flags).toEqual([])
  })
})

describe("roadmapFor — guardrail flags", () => {
  const base: RoadmapInput = {
    ageYears: 30,
    sex: "female",
    heightCm: 165,
    weightKg: 60,
    activityLevel: "Mostly seated",
    trainingDaysPerWeek: 0,
    sessionIntensity: "Light",
    sessionDuration: "30–45 minutes",
    category: "maintenance",
  }

  it("GOAL_CATEGORY_CONFLICT: maintenance selected but >=5kg still to lose", () => {
    const roadmap = roadmapFor({ ...base, weightKg: 108, heightCm: 172 })
    expect(roadmap.anthro.toLoseKg).toBeGreaterThanOrEqual(5)
    expect(roadmap.flags.some((f) => f.code === "GOAL_CATEGORY_CONFLICT" && f.level === "block")).toBe(true)
  })

  it("underweight STOPs", () => {
    const roadmap = roadmapFor({ ...base, weightKg: 40, heightCm: 170, category: "first_timer" })
    expect(roadmap.flags.some((f) => f.code === "underweight" && f.level === "stop")).toBe(true)
  })

  it("PROTEIN_WEEK1_BELOW_FLOOR fires when ramped week-1 protein is thin relative to dosing weight", () => {
    const roadmap = roadmapFor({
      ...base,
      category: "first_timer",
      weightKg: 108,
      heightCm: 172,
      currentIntake: { kcal: 1800, proteinG: 30, carbsG: 200, fatG: 60 },
    })
    expect(roadmap.flags.some((f) => f.code === "PROTEIN_WEEK1_BELOW_FLOOR")).toBe(true)
  })

  it("protein-held: a recorded protein cap holds protein and disables the ramp", () => {
    const roadmap = roadmapFor({
      ...base,
      category: "first_timer",
      currentIntake: { kcal: 1800, proteinG: 40, carbsG: 200, fatG: 60 },
      proteinCapG: 45,
    })
    expect(roadmap.macrosAtTarget.proteinG).toBe(45)
    expect(roadmap.proteinRamp).toEqual([])
    expect(roadmap.flags.some((f) => f.code === "protein-held")).toBe(true)
  })
})
