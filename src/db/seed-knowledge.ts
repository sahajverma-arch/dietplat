/**
 * Seeds `dietitian_knowledge_docs` and `dietitian_knowledge_chunks` from
 * every .md file under src/db/seed-data/dietitian-knowledge/ (see
 * CLAUDE.md "Dietitian knowledge layer"). Mirrors seed-recipes.ts's exact
 * shape: idempotent upsert-by-slug via Drizzle's own `.update()`/
 * `.insert()` builders (never a raw `sql` template), diagnostics
 * accumulated during the loop and printed as a banner report after, hard
 * refusal on a genuine conflict. Re-run with `npm run seed:knowledge`.
 *
 * Chunks are recomputed fresh every run (delete-then-reinsert per doc) —
 * simpler than piecemeal chunk upserts and mirrors how recipe_aliases'
 * generated rows are recomputed fresh every seed-recipes.ts run.
 *
 * Refuses to proceed if two source files claim the same frontmatter `id`
 * — a genuine slug collision needs a human decision, same class of guard
 * as seed-recipes.ts's duplicate-name refusal.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { eq } from "drizzle-orm"

import { parseKnowledgeMarkdown, type ParsedKnowledgeDoc } from "@/lib/foods/knowledge-markdown-parser"

import { db } from "./index"
import { dietitianKnowledgeChunks, dietitianKnowledgeDocs } from "./schema"

const KNOWLEDGE_DIR = join(process.cwd(), "src/db/seed-data/dietitian-knowledge")

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

function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface LoadedDoc {
  sourceFile: string
  parsed: ParsedKnowledgeDoc
}

function loadAllDocs(): LoadedDoc[] {
  if (!statSync(KNOWLEDGE_DIR, { throwIfNoEntry: false })) {
    console.log(`No knowledge base directory found at ${KNOWLEDGE_DIR} — seeding zero docs.`)
    return []
  }
  const files = walkMarkdownFiles(KNOWLEDGE_DIR)
  return files.map((filePath) => {
    const sourceFile = relative(KNOWLEDGE_DIR, filePath).replace(/\\/g, "/")
    const raw = readFileSync(filePath, "utf8")
    return { sourceFile, parsed: parseKnowledgeMarkdown(raw, sourceFile) }
  })
}

async function main() {
  const docs = loadAllDocs()
  console.log(`Found ${docs.length} knowledge markdown file(s) under src/db/seed-data/dietitian-knowledge/.`)

  const idToFiles = new Map<string, string[]>()
  for (const doc of docs) {
    const list = idToFiles.get(doc.parsed.frontmatter.id) ?? []
    list.push(doc.sourceFile)
    idToFiles.set(doc.parsed.frontmatter.id, list)
  }
  const collisions = [...idToFiles.entries()].filter(([, files]) => files.length > 1)
  if (collisions.length > 0) {
    console.error(`\nRefusing to seed: ${collisions.length} frontmatter id collision(s) across source files.`)
    for (const [id, files] of collisions) {
      console.error(`  id "${id}" claimed by: ${files.join(", ")}`)
    }
    process.exit(1)
  }

  const existingBySlug = new Map<string, string>()
  for (const d of await db.select({ id: dietitianKnowledgeDocs.id, slug: dietitianKnowledgeDocs.slug }).from(dietitianKnowledgeDocs)) {
    existingBySlug.set(d.slug, d.id)
  }

  const allWarnings: string[] = []
  const statusDistribution = new Map<string, number>()
  const categoryDistribution = new Map<string, number>()
  let totalChunks = 0
  let docsInserted = 0
  let docsUpdated = 0

  console.log(`Seeding ${docs.length} knowledge doc(s)...`)
  for (const { sourceFile, parsed } of docs) {
    const { frontmatter, chunks, warnings } = parsed
    allWarnings.push(...warnings)
    statusDistribution.set(frontmatter.status, (statusDistribution.get(frontmatter.status) ?? 0) + 1)
    categoryDistribution.set(frontmatter.category, (categoryDistribution.get(frontmatter.category) ?? 0) + 1)

    const values = {
      slug: frontmatter.id,
      title: frontmatter.title,
      category: frontmatter.category,
      status: frontmatter.status,
      version: frontmatter.version,
      confirmedBy: frontmatter.confirmedBy,
      confirmedAt: frontmatter.confirmedAt ? new Date(frontmatter.confirmedAt) : null,
      regions: frontmatter.regions,
      dietTypes: frontmatter.dietTypes,
      goals: frontmatter.goals,
      mealSlots: frontmatter.mealSlots,
      weight: frontmatter.weight,
      sourceFile,
      rawMarkdown: readFileSync(join(KNOWLEDGE_DIR, sourceFile), "utf8"),
    }

    let docId = existingBySlug.get(frontmatter.id)
    if (docId) {
      await db.update(dietitianKnowledgeDocs).set(values).where(eq(dietitianKnowledgeDocs.id, docId))
      docsUpdated++
    } else {
      const [inserted] = await db.insert(dietitianKnowledgeDocs).values(values).returning({ id: dietitianKnowledgeDocs.id })
      docId = inserted.id
      docsInserted++
    }

    await db.delete(dietitianKnowledgeChunks).where(eq(dietitianKnowledgeChunks.docId, docId))
    if (chunks.length > 0) {
      const seenSlugs = new Set<string>()
      const chunkValues = chunks.map((c) => {
        let slug = `${frontmatter.id}#${slugifyHeading(c.heading)}`
        let n = 2
        while (seenSlugs.has(slug)) {
          slug = `${frontmatter.id}#${slugifyHeading(c.heading)}-${n}`
          n++
        }
        seenSlugs.add(slug)
        return {
          docId: docId as string,
          slug,
          heading: c.heading,
          chunkOrder: c.chunkOrder,
          content: c.content,
          estimatedTokens: c.estimatedTokens,
        }
      })
      await db.insert(dietitianKnowledgeChunks).values(chunkValues)
      totalChunks += chunkValues.length
    }
  }
  console.log(`Docs: ${docsInserted} inserted, ${docsUpdated} updated. Chunks: ${totalChunks} total.`)

  console.log("\n=== Ingestion warnings (review before trusting this seed) ===")
  if (allWarnings.length === 0) {
    console.log("(none)")
  } else {
    allWarnings.forEach((w) => console.log(`  - ${w}`))
  }
  console.log(`\nStatus distribution: ${[...statusDistribution.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)
  console.log(`Category distribution: ${[...categoryDistribution.entries()].sort().map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`)

  console.log("\nDone.")
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
