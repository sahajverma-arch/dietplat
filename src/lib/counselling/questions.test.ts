import { describe, expect, it } from "vitest"
import { QUESTIONS, findQuestion, questionsForSection } from "./questions"

// 332 from the source PDF + 4 deliberate additions (q29b_est_kcal/protein_g/
// carbs_g/fat_g, Section 6) — see questions.ts's top comment for why: q29a's
// own note instructs an estimate the PDF never gave a field to record,
// and without one roadmap-input.ts had nothing to build
// RoadmapInput.currentIntake from (protein ramp, chronic-under-eating flag,
// already-below-target branch were all silently dead for real clients).
const PDF_QUESTION_COUNT = 332
const ADDED_BEYOND_PDF = 4

describe("question bank", () => {
  it("has exactly the PDF's question count plus the documented additions", () => {
    expect(QUESTIONS.length).toBe(PDF_QUESTION_COUNT + ADDED_BEYOND_PDF)
  })

  it("has no duplicate ids", () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("matches the per-section counts documented in the PDF (plus the 4 documented additions in section 6)", () => {
    const expected: Record<string, number> = {
      client: 5,
      "1": 12,
      "2": 21,
      "3": 13,
      "4": 29,
      "5": 37,
      "6": 89 + ADDED_BEYOND_PDF,
      "7": 13,
      "8": 11,
      "9": 25,
      "10": 18,
      "11": 30,
      "12": 11,
      "13": 7,
      "14": 11,
    }
    for (const [section, count] of Object.entries(expected)) {
      expect(questionsForSection(section).length, `section ${section}`).toBe(count)
    }
  })

  it("resolves key ids used by roadmapFor() and the exchange solver", () => {
    for (const id of ["q9_age", "gender", "q9_height", "q9_weight", "q54c", "q44a", "q44b", "q44e", "q76_category", "q33", "q34"]) {
      expect(findQuestion(id), id).toBeDefined()
    }
  })

  it("every multi/single question has a non-empty options list", () => {
    for (const q of QUESTIONS) {
      if (q.type === "single" || q.type === "multi" || q.type === "portions") {
        expect(q.options?.length ?? 0, q.id).toBeGreaterThan(0)
      }
    }
  })
})
