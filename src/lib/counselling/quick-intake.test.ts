import { describe, expect, it } from "vitest"
import {
  fillUnaskedRequired,
  missingRequired,
  QUICK_ASKED_IDS,
  QUICK_GROUPS,
  stripSentinelFields,
  UNCOLLECTED_SENTINEL,
  unaskedRequiredQuestions,
} from "./quick-intake"

describe("quick intake", () => {
  it("asks exactly 33 questions across 9 groups (30 from the PDF + 3 current-intake questions added beyond it)", () => {
    expect(QUICK_GROUPS.length).toBe(9)
    expect(QUICK_ASKED_IDS.size).toBe(33)
  })

  it("auto-fills exactly the 41 required-but-unasked full-form questions listed in the PDF", () => {
    const expectedIds = [
      "q54", "q1", "q4", "q10", "q12", "q13", "q20", "q21", "q22", "q23", "q25", "q29", "q50a", "q31", "q37",
      "q39", "q41", "q106", "q51", "q53", "q52", "q56", "q55", "q58", "q60", "q69", "q61", "q61a", "q62", "q63",
      "q65", "q67", "q73", "q71", "q72", "q74", "q75", "q70", "q76", "q77", "q89",
    ]
    const actualIds = unaskedRequiredQuestions().map((q) => q.id)
    expect(actualIds.length).toBe(41)
    expect(new Set(actualIds)).toEqual(new Set(expectedIds))
  })

  it("fillUnaskedRequired sentinels every unasked-required field and nothing else", () => {
    const filled = fillUnaskedRequired({ name: "Anita Verma" })
    expect(filled.q54).toBe(UNCOLLECTED_SENTINEL)
    expect(filled.name).toBe("Anita Verma")
    expect(filled.q9_age).toBeUndefined()
  })

  it("stripSentinelFields removes only sentinel values", () => {
    const stripped = stripSentinelFields({ name: "Anita", q54: UNCOLLECTED_SENTINEL, q9_age: 30 })
    expect(stripped).toEqual({ name: "Anita", q9_age: 30 })
  })

  it("missingRequired('quick') never flags the 41 auto-filled ids, only the 30 asked ones", () => {
    const missing = missingRequired({}, "quick")
    expect(missing).not.toContain("q54")
    expect(missing).toContain("name")
    expect(missing).toContain("q76_category")
  })

  it("a fully answered + sentinel-filled quick session has zero missing required fields", () => {
    const answers = fillUnaskedRequired({
      name: "Anita Verma",
      gender: "Female",
      phone: "+91 9800000000",
      q9_age: 30,
      q9_height: 160,
      q9_weight: 70,
      q2: "Fat Loss",
      q76_category: "First-timer — never dieted with structure before",
      q54c: "Lightly active",
      q43: ["Currently not exercising"],
      q44d: "Complete beginner",
      q33: "Vegetarian",
      q27: ["No known allergy or intolerance"],
      q36: "none",
      q35: "dal chawal",
      q34: ["North Indian"],
      q28: ["Breakfast", "Lunch", "Dinner"],
      q38: ["No restriction"],
      q17: ["No Medical Condition"],
      q19: "No",
    })
    expect(missingRequired(answers, "quick")).toEqual([])
  })
})
