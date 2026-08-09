import { describe, expect, it } from "vitest"

import type { Answers } from "./questions"
import { roadmapInputFromAnswers, RoadmapInputError } from "./roadmap-input"

const BASE_ANSWERS: Answers = {
  q9_age: 32,
  gender: "Female",
  q9_height: 160,
  q9_weight: 74,
  q54c: "Lightly active",
  q76_category: "First-timer — never dieted with structure before",
}

describe("roadmapInputFromAnswers", () => {
  it("throws RoadmapInputError when a required field is missing", () => {
    expect(() => roadmapInputFromAnswers({})).toThrow(RoadmapInputError)
  })

  it("throws when gender is not a binary Male/Female term", () => {
    expect(() => roadmapInputFromAnswers({ ...BASE_ANSWERS, gender: "Prefer not to say" })).toThrow(RoadmapInputError)
  })

  it("leaves currentIntake undefined when none of the q29b fields are answered", () => {
    const result = roadmapInputFromAnswers(BASE_ANSWERS)
    expect(result.currentIntake).toBeUndefined()
  })

  it("leaves currentIntake undefined on a partial fill (protein/carbs present, fat missing)", () => {
    const result = roadmapInputFromAnswers({
      ...BASE_ANSWERS,
      q29b_est_protein_g: 55,
      q29b_est_carbs_g: 210,
    })
    expect(result.currentIntake).toBeUndefined()
  })

  it("uses the reported kcal as-is when protein/carbs/fat AND kcal are all present (full form)", () => {
    const result = roadmapInputFromAnswers({
      ...BASE_ANSWERS,
      q29b_est_kcal: 1625,
      q29b_est_protein_g: 50,
      q29b_est_carbs_g: 218,
      q29b_est_fat_g: 60,
    })
    // Atwater sum here is 1612, not 1625 — the reported figure must win, not be overwritten.
    expect(result.currentIntake).toEqual({ kcal: 1625, proteinG: 50, carbsG: 218, fatG: 60 })
  })

  it("derives kcal via Atwater factors when protein/carbs/fat are present but kcal was never asked (quick form)", () => {
    const result = roadmapInputFromAnswers({
      ...BASE_ANSWERS,
      q29b_est_protein_g: 55,
      q29b_est_carbs_g: 210,
      q29b_est_fat_g: 60,
    })
    // 55*4 + 210*4 + 60*9 = 220 + 840 + 540 = 1600
    expect(result.currentIntake).toEqual({ kcal: 1600, proteinG: 55, carbsG: 210, fatG: 60 })
  })

  it("derives kcal when a reported q29b_est_kcal is present but not a finite number", () => {
    const result = roadmapInputFromAnswers({
      ...BASE_ANSWERS,
      q29b_est_kcal: Number.NaN,
      q29b_est_protein_g: 55,
      q29b_est_carbs_g: 210,
      q29b_est_fat_g: 60,
    })
    expect(result.currentIntake).toEqual({ kcal: 1600, proteinG: 55, carbsG: 210, fatG: 60 })
  })
})
