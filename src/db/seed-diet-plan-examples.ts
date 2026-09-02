/**
 * Seeds `diet_plan_examples` from every .md file under
 * src/db/seed-data/diet-plan-examples/{real,synthetic}/ (see CLAUDE.md
 * "Diet plan examples layer"). Mirrors seed-knowledge.ts's exact shape —
 * idempotent upsert-by-slug via Drizzle's own `.update()`/`.insert()`
 * builders, diagnostics accumulated during the loop and printed as a
 * banner report after, hard refusal on a genuine conflict — but simpler:
 * there is no child chunks table here, each markdown file IS one
 * `diet_plan_examples` row 1:1, so there's no delete-then-reinsert step.
 *
 * Refuses to proceed if two source files claim the same frontmatter `id`,
 * or if a `sourceType: real` file is missing sourceUrl/sourceCredibility
 * — real-tier content must always carry real attribution; that rule is
 * enforced here at ingestion, not as a DB constraint. Re-run with
 * `npm run seed:diet-plan-examples`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { eq } from "drizzle-orm"

import { parseDietPlanExampleMarkdown, type ParsedDietPlanExample } from "@/lib/plan/diet-plan-example-markdown-parser"

import { db } from "./index"
import { dietPlanExamples } from "./schema"

const EXAMPLES_DIR = join(process.cwd(), "src/db/seed-data/diet-plan-examples")

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath))
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath)
    }
  }
  return files
}

interface LoadedExample {
  sourceFile: string
  parsed: ParsedDietPlanExample
}

function loadAllExamples(): LoadedExample[] {
  if (!statSync(EXAMPLES_DIR, { throwIfNoEntry: false })) {
    console.log(`No diet plan examples directory found at ${EXAMPLES_DIR} — seeding zero examples.`)
    return []
  }
  const files = walkMarkdownFiles(EXAMPLES_DIR)
  return files.map((filePath) => {
    const sourceFile = relative(EXAMPLES_DIR, filePath).replace(/\\/g, "/")
    const raw = readFileSync(filePath, "utf8")
    return { sourceFile, parsed: parseDietPlanExampleMarkdown(raw, sourceFile) }
  })
}

function estimateTokens(parsed: ParsedDietPlanExample): number {
  const mealStructureChars = parsed.mealStructure.reduce((sum, slot) => sum + slot.slot.length + (slot.timeHint?.length ?? 0) + slot.items.join("; ").length, 0)
  const reasoningChars = parsed.reasoning?.length ?? 0
  return Math.ceil((mealStructureChars + reasoningChars) / 4)
}

async function main() {
  const examples = loadAllExamples()
  console.log(`Found ${examples.length} diet plan example markdown file(s) under src/db/seed-data/diet-plan-examples/.`)

  const idToFiles = new Map<string, string[]>()
  for (const ex of examples) {
    const list = idToFiles.get(ex.parsed.frontmatter.id) ?? []
    list.push(ex.sourceFile)
    idToFiles.set(ex.parsed.frontmatter.id, list)
  }
  const collisions = [...idToFiles.entries()].filter(([, files]) => files.length > 1)
  if (collisions.length > 0) {
    console.error(`\nRefusing to seed: ${collisions.length} frontmatter id collision(s) across source files.`)
    for (const [id, files] of collisions) {
      console.error(`  id "${id}" claimed by: ${files.join(", ")}`)
    }
    process.exit(1)
  }

  const missingAttribution = examples.filter(
    (ex) => ex.parsed.frontmatter.sourceType === "real" && (!ex.parsed.frontmatter.sourceUrl || !ex.parsed.frontmatter.sourceCredibility)
  )
  if (missingAttribution.length > 0) {
    console.error(`\nRefusing to seed: ${missingAttribution.length} sourceType=real file(s) missing sourceUrl/sourceCredibility.`)
    for (const ex of missingAttribution) {
      console.error(`  "${ex.parsed.frontmatter.id}" (${ex.sourceFile})`)
    }
    process.exit(1)
  }

  const existingBySlug = new Map<string, string>()
  for (const e of await db.select({ id: dietPlanExamples.id, slug: dietPlanExamples.slug }).from(dietPlanExamples)) {
    existingBySlug.set(e.slug, e.id)
  }

  const allWarnings: string[] = []
  const statusDistribution = new Map<string, number>()
  const goalDistribution = new Map<string, number>()
  const regionDistribution = new Map<string, number>()
  const sourceTypeDistribution = new Map<string, number>()
  let inserted = 0
  let updated = 0

  console.log(`Seeding ${examples.length} diet plan example(s)...`)
  for (const { sourceFile, parsed } of examples) {
    const { frontmatter, mealStructure, reasoning, warnings } = parsed
    allWarnings.push(...warnings)
    statusDistribution.set(frontmatter.status, (statusDistribution.get(frontmatter.status) ?? 0) + 1)
    goalDistribution.set(frontmatter.goal, (goalDistribution.get(frontmatter.goal) ?? 0) + 1)
    regionDistribution.set(frontmatter.region, (regionDistribution.get(frontmatter.region) ?? 0) + 1)
    sourceTypeDistribution.set(frontmatter.sourceType, (sourceTypeDistribution.get(frontmatter.sourceType) ?? 0) + 1)

    const values = {
      slug: frontmatter.id,
      goal: frontmatter.goal,
      dietTypes: frontmatter.dietTypes,
      region: frontmatter.region,
      gender: frontmatter.gender,
      calorieMin: frontmatter.calorieMin,
      calorieMax: frontmatter.calorieMax,
      mealCount: frontmatter.mealCount,
      mealStructure,
      reasoning,
      condition: frontmatter.condition,
      sourceType: frontmatter.sourceType,
      sourceUrl: frontmatter.sourceUrl,
      sourceCredibility: frontmatter.sourceCredibility,
      status: frontmatter.status,
      weight: frontmatter.weight,
      dayLabel: frontmatter.dayLabel,
      sourceFile,
      rawMarkdown: readFileSync(join(EXAMPLES_DIR, sourceFile), "utf8"),
      estimatedTokens: estimateTokens(parsed),
    }

    const existingId = existingBySlug.get(frontmatter.id)
    if (existingId) {
      await db.update(dietPlanExamples).set(values).where(eq(dietPlanExamples.id, existingId))
      updated++
    } else {
      await db.insert(dietPlanExamples).values(values)
      inserted++
    }
  }
  console.log(`Diet plan examples: ${inserted} inserted, ${updated} updated.`)

  console.log("\n=== Ingestion warnings (review before trusting this seed) ===")
  if (allWarnings.length === 0) {
    console.log("(none)")
  } else {
    allWarnings.forEach((w) => console.log(`  - ${w}`))
  }
  console.log(`\nStatus distribution: ${[...statusDistribution.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)
  console.log(`Goal distribution: ${[...goalDistribution.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)
  console.log(`Region distribution: ${[...regionDistribution.entries()].sort().map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)
  console.log(`Source type distribution (real vs. synthetic): ${[...sourceTypeDistribution.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)

  console.log("\nDone.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
