import { describe, expect, it } from "vitest"

import { parseDietPlanExampleMarkdown } from "./diet-plan-example-markdown-parser"

function makeDoc(overrides: Record<string, string> = {}) {
  const fm: Record<string, string> = {
    id: "test-example",
    goal: "fat_loss",
    dietTypes: "[vegetarian, eggetarian]",
    region: "Punjabi",
    gender: "any",
    calorieMin: "1150",
    calorieMax: "1250",
    mealCount: "2",
    dayLabel: "null",
    condition: "[]",
    sourceType: "real",
    sourceUrl: '"https://example.com/plan"',
    sourceCredibility: '"Registered Dietitian, 10yr, Example Clinic"',
    status: "draft",
    weight: "8",
    ...overrides,
  }
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
  return `---
${yaml}
---

## Meal Structure
- Breakfast (8am): Methi paratha (2, no-fat); Curd (1 bowl)
- Lunch: Roti (2); Dal (1 bowl); Salad

## Reasoning
Traditional technique substitution keeps the cuisine authentic while controlling fat.
`
}

describe("parseDietPlanExampleMarkdown", () => {
  it("parses frontmatter into the full structured shape", () => {
    const { frontmatter } = parseDietPlanExampleMarkdown(makeDoc(), "test.md")
    expect(frontmatter).toEqual({
      id: "test-example",
      goal: "fat_loss",
      dietTypes: ["vegetarian", "eggetarian"],
      region: "Punjabi",
      gender: "any",
      calorieMin: 1150,
      calorieMax: 1250,
      mealCount: 2,
      dayLabel: null,
      condition: [],
      sourceType: "real",
      sourceUrl: "https://example.com/plan",
      sourceCredibility: "Registered Dietitian, 10yr, Example Clinic",
      status: "draft",
      weight: 8,
    })
  })

  it("parses the Meal Structure section into one slot per line, with and without a timeHint", () => {
    const { mealStructure } = parseDietPlanExampleMarkdown(makeDoc(), "test.md")
    expect(mealStructure).toEqual([
      { slot: "Breakfast", timeHint: "8am", items: ["Methi paratha (2, no-fat)", "Curd (1 bowl)"] },
      { slot: "Lunch", timeHint: null, items: ["Roti (2)", "Dal (1 bowl)", "Salad"] },
    ])
  })

  it("parses and strips the disclosure line from Reasoning", () => {
    const raw = makeDoc().replace(
      "Traditional technique substitution keeps the cuisine authentic while controlling fat.",
      "Traditional technique substitution keeps the cuisine authentic while controlling fat.\n\n**UNVERIFIED — pending dietitian confirmation.**"
    )
    const { reasoning } = parseDietPlanExampleMarkdown(raw, "test.md")
    expect(reasoning).not.toContain("UNVERIFIED")
    expect(reasoning).toContain("technique substitution")
  })

  it("returns null reasoning when the Reasoning section is absent", () => {
    const raw = makeDoc().replace(/## Reasoning[\s\S]*$/, "")
    const { reasoning } = parseDietPlanExampleMarkdown(raw, "test.md")
    expect(reasoning).toBeNull()
  })

  it("throws when the Meal Structure section is missing", () => {
    const raw = makeDoc().replace(/## Meal Structure[\s\S]*?## Reasoning/, "## Reasoning")
    expect(() => parseDietPlanExampleMarkdown(raw, "test.md")).toThrow(/Meal Structure/)
  })

  it("throws on an invalid goal", () => {
    expect(() => parseDietPlanExampleMarkdown(makeDoc({ goal: "get_shredded" }), "test.md")).toThrow(/goal/)
  })

  it("throws on a missing region", () => {
    expect(() => parseDietPlanExampleMarkdown(makeDoc({ region: "" }), "test.md")).toThrow(/region/)
  })

  it("throws on an invalid sourceType", () => {
    expect(() => parseDietPlanExampleMarkdown(makeDoc({ sourceType: "made_up" }), "test.md")).toThrow(/sourceType/)
  })

  it("defaults gender to any with a warning on an invalid value", () => {
    const { frontmatter, warnings } = parseDietPlanExampleMarkdown(makeDoc({ gender: "unspecified" }), "test.md")
    expect(frontmatter.gender).toBe("any")
    expect(warnings.some((w) => w.includes("gender"))).toBe(true)
  })

  it("warns when a meal structure line doesn't match the expected shape", () => {
    const raw = makeDoc().replace("- Lunch: Roti (2); Dal (1 bowl); Salad", "- this line has no colon separator")
    const { mealStructure, warnings } = parseDietPlanExampleMarkdown(raw, "test.md")
    expect(mealStructure).toHaveLength(1)
    expect(warnings.some((w) => w.includes("does not match"))).toBe(true)
  })

  it("warns when frontmatter mealCount doesn't match the real parsed slot count", () => {
    const { warnings } = parseDietPlanExampleMarkdown(makeDoc({ mealCount: "5" }), "test.md")
    expect(warnings.some((w) => w.includes("mealCount"))).toBe(true)
  })

  it("supports synthetic examples with no sourceUrl/sourceCredibility", () => {
    const { frontmatter } = parseDietPlanExampleMarkdown(
      makeDoc({ sourceType: "synthetic", sourceUrl: "null", sourceCredibility: "null" }),
      "test.md"
    )
    expect(frontmatter.sourceType).toBe("synthetic")
    expect(frontmatter.sourceUrl).toBeNull()
    expect(frontmatter.sourceCredibility).toBeNull()
  })
})
