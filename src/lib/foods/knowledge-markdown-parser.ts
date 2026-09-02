/**
 * Hand-rolled frontmatter + H2-chunk parser for the Dietitian Knowledge RAG
 * layer's markdown source files (src/db/seed-data/dietitian-knowledge/).
 * No markdown/YAML dependency exists in this stack (confirmed: no
 * gray-matter/remark/unified/js-yaml in package.json) and the frontmatter
 * here is flat scalars/arrays only — genuinely simple to split on `---`
 * fences with a line scan, matching this codebase's revealed preference
 * for small hand-rolled parsers (see csv-parser.ts's own quoted-CSV state
 * machine) over adding a dependency.
 *
 * Doc-level frontmatter only, no per-heading frontmatter — every H2 chunk
 * in a doc inherits the same regions/dietTypes/goals/mealSlots filters. A
 * doc whose sections genuinely need different filters should be split into
 * separate files instead (see CLAUDE.md "Dietitian knowledge layer").
 */

export const KNOWLEDGE_CATEGORIES = [
  "meal_pattern",
  "meal_slot",
  "region",
  "goal",
  "combination",
  "serving_norm",
  "protein",
  "variety",
  "adherence",
  "reasoning_example",
] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

export interface KnowledgeFrontmatter {
  id: string
  title: string
  category: KnowledgeCategory
  status: "draft" | "confirmed"
  version: number
  confirmedBy: string | null
  confirmedAt: string | null
  regions: string[]
  dietTypes: string[]
  goals: string[]
  mealSlots: string[]
  weight: number
}

export interface ParsedKnowledgeChunk {
  heading: string
  content: string
  chunkOrder: number
  estimatedTokens: number
}

export interface ParsedKnowledgeDoc {
  frontmatter: KnowledgeFrontmatter
  chunks: ParsedKnowledgeChunk[]
  warnings: string[]
}

const CHUNK_WORD_MIN = 50
const CHUNK_WORD_MAX = 200

// The doc-level "unconfirmed content" disclosure (see CLAUDE.md's own
// established convention, e.g. the Laal Murgh/Meen Curry entries) is meant
// for a human auditing the source markdown/raw_markdown column — not for
// the LLM prompt. It's authored inside whichever H2 section happens to be
// a doc's last, so it must be stripped from that chunk's own `content`
// before retrieval/injection, not just left to flow through. The full,
// unstripped markdown is still preserved verbatim in raw_markdown.
const DISCLOSURE_LINE = /\*\*UNVERIFIED\s*—\s*pending dietitian confirmation\.\*\*/g

function parseScalar(raw: string): string | number | null {
  const trimmed = raw.trim()
  if (trimmed === "null" || trimmed === "") return null
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

function parseArray(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return []
  const inner = trimmed.slice(1, -1).trim()
  if (inner === "") return []
  return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean)
}

function splitFrontmatter(raw: string): { yaml: string; body: string } {
  if (!raw.startsWith("---")) {
    throw new Error("Knowledge markdown file must start with a `---` frontmatter fence")
  }
  const firstLineEnd = raw.indexOf("\n")
  const closeIndex = raw.indexOf("\n---", firstLineEnd)
  if (closeIndex === -1) {
    throw new Error("Knowledge markdown file's frontmatter is never closed with a second `---` fence")
  }
  const yaml = raw.slice(firstLineEnd + 1, closeIndex)
  const bodyStart = raw.indexOf("\n", closeIndex + 1)
  const body = bodyStart === -1 ? "" : raw.slice(bodyStart + 1)
  return { yaml, body }
}

function parseFrontmatter(yaml: string, warnings: string[]): KnowledgeFrontmatter {
  const raw: Record<string, string> = {}
  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue
    raw[line.slice(0, colonIndex).trim()] = line.slice(colonIndex + 1)
  }

  const id = raw.id ? String(parseScalar(raw.id) ?? "") : ""
  const title = raw.title ? String(parseScalar(raw.title) ?? "") : ""
  const category = raw.category ? String(parseScalar(raw.category) ?? "") : ""
  if (!id) throw new Error("Knowledge doc frontmatter is missing required field: id")
  if (!title) throw new Error("Knowledge doc frontmatter is missing required field: title")
  if (!KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory)) {
    throw new Error(`Knowledge doc "${id}" has an invalid category: "${category}" (must be one of ${KNOWLEDGE_CATEGORIES.join(", ")})`)
  }

  const status = raw.status ? String(parseScalar(raw.status)) : "draft"
  if (status !== "draft" && status !== "confirmed") {
    throw new Error(`Knowledge doc "${id}" has an invalid status: "${status}" (must be draft or confirmed)`)
  }

  let version = 1
  if (raw.version) {
    const v = parseScalar(raw.version)
    version = typeof v === "number" ? v : 1
    if (typeof v !== "number") warnings.push(`${id}: version "${raw.version}" is not a number, defaulted to 1`)
  }

  let weight = 5
  if (raw.weight) {
    const w = parseScalar(raw.weight)
    weight = typeof w === "number" ? w : 5
    if (typeof w !== "number") warnings.push(`${id}: weight "${raw.weight}" is not a number, defaulted to 5`)
  }

  const confirmedByRaw = raw.confirmedBy ? parseScalar(raw.confirmedBy) : null
  const confirmedAtRaw = raw.confirmedAt ? parseScalar(raw.confirmedAt) : null

  return {
    id,
    title,
    category: category as KnowledgeCategory,
    status,
    version,
    confirmedBy: confirmedByRaw === null ? null : String(confirmedByRaw),
    confirmedAt: confirmedAtRaw === null ? null : String(confirmedAtRaw),
    regions: raw.regions ? parseArray(raw.regions) : [],
    dietTypes: raw.dietTypes ? parseArray(raw.dietTypes) : [],
    goals: raw.goals ? parseArray(raw.goals) : [],
    mealSlots: raw.mealSlots ? parseArray(raw.mealSlots) : [],
    weight,
  }
}

function parseChunks(body: string, docId: string, warnings: string[]): ParsedKnowledgeChunk[] {
  const lines = body.split("\n")
  const headingIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) headingIndices.push(i)
  }

  const preamble = lines.slice(0, headingIndices[0] ?? lines.length).join("\n").trim()
  const preambleWithoutTitle = preamble.replace(/^#\s+.+$/m, "").trim()
  if (preambleWithoutTitle.length > 0) {
    warnings.push(`${docId}: content before the first H2 heading is not chunked and will never be retrievable`)
  }

  const chunks: ParsedKnowledgeChunk[] = []
  const seenHeadings = new Set<string>()
  for (let i = 0; i < headingIndices.length; i++) {
    const start = headingIndices[i]
    const end = i + 1 < headingIndices.length ? headingIndices[i + 1] : lines.length
    const heading = lines[start].slice(3).trim()
    const content = lines
      .slice(start + 1, end)
      .join("\n")
      .replace(DISCLOSURE_LINE, "")
      .trim()

    if (seenHeadings.has(heading)) {
      warnings.push(`${docId}: duplicate H2 heading "${heading}" — later occurrence still chunked, but retrieval can't distinguish them`)
    }
    seenHeadings.add(heading)

    if (content.length === 0) {
      warnings.push(`${docId}: H2 heading "${heading}" has no content, skipped`)
      continue
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length
    if (wordCount < CHUNK_WORD_MIN || wordCount > CHUNK_WORD_MAX) {
      warnings.push(`${docId}: chunk "${heading}" is ${wordCount} words, outside the ~${CHUNK_WORD_MIN}-${CHUNK_WORD_MAX} target`)
    }

    chunks.push({ heading, content, chunkOrder: chunks.length, estimatedTokens: Math.ceil(content.length / 4) })
  }

  if (chunks.length === 0) {
    warnings.push(`${docId}: no H2 sections found — this doc has zero retrievable chunks`)
  }

  return chunks
}

/** `sourceFile` is never read by the parser itself — it's threaded straight into every warning message so a seed-script diagnostic points at a real path, not just a doc id. */
export function parseKnowledgeMarkdown(raw: string, sourceFile: string): ParsedKnowledgeDoc {
  const warnings: string[] = []
  const { yaml, body } = splitFrontmatter(raw)
  const frontmatter = parseFrontmatter(yaml, warnings)
  const chunks = parseChunks(body, frontmatter.id, warnings)
  return { frontmatter, chunks, warnings: warnings.map((w) => `${sourceFile}: ${w}`) }
}
