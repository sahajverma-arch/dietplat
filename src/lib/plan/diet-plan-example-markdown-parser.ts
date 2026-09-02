/**
 * Hand-rolled frontmatter + two-named-section parser for the Diet Plan
 * Examples RAG layer's markdown source files
 * (src/db/seed-data/diet-plan-examples/{real,synthetic}/**). Genuinely
 * different in kind from knowledge-markdown-parser.ts's H2-chunking: one
 * markdown file here is ONE complete example day, not several independent
 * fragments — chunking it the same way would destroy the "complete day"
 * signal this layer exists to preserve. The body has exactly two named
 * sections, `## Meal Structure` and `## Reasoning`, parsed into fields of
 * ONE record, not an array of interchangeable chunks.
 *
 * The small generic helpers below (parseScalar/parseArray/
 * splitFrontmatter/the frontmatter line-scan) are deliberately duplicated
 * from knowledge-markdown-parser.ts rather than imported — this codebase's
 * own explicit, repeated choice not to share tiny helpers (see
 * `stableHash`, independently duplicated in 5 files) and
 * knowledge-markdown-parser.ts doesn't export them anyway.
 */

export const DIET_PLAN_EXAMPLE_GOALS = ["fat_loss", "muscle_gain", "maintenance"] as const
export type DietPlanExampleGoal = (typeof DIET_PLAN_EXAMPLE_GOALS)[number]

const DIET_PLAN_EXAMPLE_GENDERS = ["male", "female", "any"] as const
type DietPlanExampleGender = (typeof DIET_PLAN_EXAMPLE_GENDERS)[number]

const DIET_PLAN_EXAMPLE_SOURCE_TYPES = ["real", "synthetic"] as const
export type DietPlanExampleSourceType = (typeof DIET_PLAN_EXAMPLE_SOURCE_TYPES)[number]

export interface DietPlanExampleFrontmatter {
  id: string
  goal: DietPlanExampleGoal
  dietTypes: string[]
  region: string
  gender: DietPlanExampleGender
  calorieMin: number
  calorieMax: number
  mealCount: number
  dayLabel: string | null
  condition: string[]
  sourceType: DietPlanExampleSourceType
  sourceUrl: string | null
  sourceCredibility: string | null
  status: "draft" | "confirmed"
  weight: number
}

export interface ParsedMealSlot {
  slot: string
  timeHint: string | null
  items: string[]
}

export interface ParsedDietPlanExample {
  frontmatter: DietPlanExampleFrontmatter
  mealStructure: ParsedMealSlot[]
  reasoning: string | null
  warnings: string[]
}

// Same disclosure convention the knowledge layer established (CLAUDE.md's
// "UNVERIFIED — pending dietitian confirmation" precedent) — reused here,
// stripped from `reasoning` before it reaches the prompt, preserved
// verbatim in raw_markdown. The regex itself is duplicated, not imported.
const DISCLOSURE_LINE = /\*\*UNVERIFIED\s*—\s*pending dietitian confirmation\.\*\*/g

function parseScalar(raw: string): string | number | null {
  const trimmed = raw.trim()
  if (trimmed === "null" || trimmed === "") return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

function parseArray(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return []
  const inner = trimmed.slice(1, -1).trim()
  if (inner === "") return []
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
}

function splitFrontmatter(raw: string): { yaml: string; body: string } {
  if (!raw.startsWith("---")) {
    throw new Error("Diet plan example markdown file must start with a `---` frontmatter fence")
  }
  const firstLineEnd = raw.indexOf("\n")
  const closeIndex = raw.indexOf("\n---", firstLineEnd)
  if (closeIndex === -1) {
    throw new Error("Diet plan example markdown file's frontmatter is never closed with a second `---` fence")
  }
  const yaml = raw.slice(firstLineEnd + 1, closeIndex)
  const bodyStart = raw.indexOf("\n", closeIndex + 1)
  const body = bodyStart === -1 ? "" : raw.slice(bodyStart + 1)
  return { yaml, body }
}

function parseFrontmatter(yaml: string, warnings: string[]): DietPlanExampleFrontmatter {
  const raw: Record<string, string> = {}
  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue
    raw[line.slice(0, colonIndex).trim()] = line.slice(colonIndex + 1)
  }

  const id = raw.id ? String(parseScalar(raw.id) ?? "") : ""
  if (!id) throw new Error("Diet plan example frontmatter is missing required field: id")

  const goal = raw.goal ? String(parseScalar(raw.goal)) : ""
  if (!DIET_PLAN_EXAMPLE_GOALS.includes(goal as DietPlanExampleGoal)) {
    throw new Error(`Diet plan example "${id}" has an invalid goal: "${goal}" (must be one of ${DIET_PLAN_EXAMPLE_GOALS.join(", ")})`)
  }

  const region = raw.region ? String(parseScalar(raw.region) ?? "") : ""
  if (!region) throw new Error(`Diet plan example "${id}" is missing required field: region`)

  const sourceType = raw.sourceType ? String(parseScalar(raw.sourceType)) : "real"
  if (!DIET_PLAN_EXAMPLE_SOURCE_TYPES.includes(sourceType as DietPlanExampleSourceType)) {
    throw new Error(`Diet plan example "${id}" has an invalid sourceType: "${sourceType}" (must be real or synthetic)`)
  }

  const status = raw.status ? String(parseScalar(raw.status)) : "draft"
  if (status !== "draft" && status !== "confirmed") {
    throw new Error(`Diet plan example "${id}" has an invalid status: "${status}" (must be draft or confirmed)`)
  }

  const gender = raw.gender ? String(parseScalar(raw.gender)) : "any"
  if (!DIET_PLAN_EXAMPLE_GENDERS.includes(gender as DietPlanExampleGender)) {
    warnings.push(`${id}: gender "${gender}" is not male/female/any, defaulted to "any"`)
  }

  const calorieMin = raw.calorieMin ? parseScalar(raw.calorieMin) : null
  const calorieMax = raw.calorieMax ? parseScalar(raw.calorieMax) : null
  if (typeof calorieMin !== "number" || typeof calorieMax !== "number") {
    throw new Error(`Diet plan example "${id}" is missing a numeric calorieMin/calorieMax`)
  }

  const mealCountRaw = raw.mealCount ? parseScalar(raw.mealCount) : null
  if (typeof mealCountRaw !== "number") {
    throw new Error(`Diet plan example "${id}" is missing a numeric mealCount`)
  }

  let weight = 5
  if (raw.weight) {
    const w = parseScalar(raw.weight)
    weight = typeof w === "number" ? w : 5
    if (typeof w !== "number") warnings.push(`${id}: weight "${raw.weight}" is not a number, defaulted to 5`)
  }

  const sourceUrlRaw = raw.sourceUrl ? parseScalar(raw.sourceUrl) : null
  const sourceCredibilityRaw = raw.sourceCredibility ? parseScalar(raw.sourceCredibility) : null
  const dayLabelRaw = raw.dayLabel ? parseScalar(raw.dayLabel) : null

  return {
    id,
    goal: goal as DietPlanExampleGoal,
    dietTypes: raw.dietTypes ? parseArray(raw.dietTypes) : [],
    region,
    gender: DIET_PLAN_EXAMPLE_GENDERS.includes(gender as DietPlanExampleGender) ? (gender as DietPlanExampleGender) : "any",
    calorieMin,
    calorieMax,
    mealCount: mealCountRaw,
    dayLabel: dayLabelRaw === null ? null : String(dayLabelRaw),
    condition: raw.condition ? parseArray(raw.condition) : [],
    sourceType: sourceType as DietPlanExampleSourceType,
    sourceUrl: sourceUrlRaw === null ? null : String(sourceUrlRaw),
    sourceCredibility: sourceCredibilityRaw === null ? null : String(sourceCredibilityRaw),
    status,
    weight,
  }
}

function findSection(body: string, heading: string): string | null {
  const lines = body.split("\n")
  const startIndex = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (startIndex === -1) return null
  let endIndex = lines.length
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endIndex = i
      break
    }
  }
  return lines
    .slice(startIndex + 1, endIndex)
    .join("\n")
    .trim()
}

const MEAL_LINE_PATTERN = /^-\s*([^:()]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.+)$/

function parseMealStructure(sectionText: string, docId: string, warnings: string[]): ParsedMealSlot[] {
  const slots: ParsedMealSlot[] = []
  for (const rawLine of sectionText.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const match = MEAL_LINE_PATTERN.exec(line)
    if (!match) {
      warnings.push(`${docId}: meal structure line does not match "- slot (timeHint): items" shape, skipped: "${line}"`)
      continue
    }
    const [, slot, timeHint, itemsRaw] = match
    const items = itemsRaw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
    if (items.length === 0) {
      warnings.push(`${docId}: meal structure line for slot "${slot.trim()}" has no items, skipped`)
      continue
    }
    slots.push({ slot: slot.trim(), timeHint: timeHint ? timeHint.trim() : null, items })
  }
  return slots
}

/** `sourceFile` is threaded into every warning message so a seed-script diagnostic points at a real path, not just a doc id. */
export function parseDietPlanExampleMarkdown(raw: string, sourceFile: string): ParsedDietPlanExample {
  const warnings: string[] = []
  const { yaml, body } = splitFrontmatter(raw)
  const frontmatter = parseFrontmatter(yaml, warnings)

  const mealStructureSection = findSection(body, "Meal Structure")
  if (mealStructureSection === null || mealStructureSection.length === 0) {
    throw new Error(`Diet plan example "${frontmatter.id}" is missing a required "## Meal Structure" section`)
  }
  const mealStructure = parseMealStructure(mealStructureSection, frontmatter.id, warnings)
  if (mealStructure.length === 0) {
    warnings.push(`${frontmatter.id}: "## Meal Structure" section produced zero parsed slots`)
  }
  if (mealStructure.length !== frontmatter.mealCount) {
    warnings.push(
      `${frontmatter.id}: frontmatter mealCount (${frontmatter.mealCount}) doesn't match the number of parsed meal-structure slots (${mealStructure.length})`
    )
  }

  const reasoningSection = findSection(body, "Reasoning")
  const reasoning = reasoningSection === null || reasoningSection.length === 0 ? null : reasoningSection.replace(DISCLOSURE_LINE, "").trim() || null

  return { frontmatter, mealStructure, reasoning, warnings: warnings.map((w) => `${sourceFile}: ${w}`) }
}
