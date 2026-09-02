import { describe, expect, it } from "vitest"

import { parseKnowledgeMarkdown } from "./knowledge-markdown-parser"

function makeDoc(frontmatterExtra = "", body = "## First Heading\nSome content here that is reasonably short.\n") {
  return `---
id: test-doc
title: "Test Doc"
category: region
status: draft
version: 1
confirmedBy: null
confirmedAt: null
regions: [Punjabi]
dietTypes: []
goals: []
mealSlots: []
weight: 5
${frontmatterExtra}---

# Test Doc

${body}`
}

describe("parseKnowledgeMarkdown", () => {
  it("parses frontmatter scalars, nulls, and arrays", () => {
    const { frontmatter } = parseKnowledgeMarkdown(makeDoc(), "test.md")
    expect(frontmatter).toEqual({
      id: "test-doc",
      title: "Test Doc",
      category: "region",
      status: "draft",
      version: 1,
      confirmedBy: null,
      confirmedAt: null,
      regions: ["Punjabi"],
      dietTypes: [],
      goals: [],
      mealSlots: [],
      weight: 5,
    })
  })

  it("throws when a required field (id) is missing", () => {
    const raw = `---
title: "No ID"
category: region
---
## Heading
Content.
`
    expect(() => parseKnowledgeMarkdown(raw, "bad.md")).toThrow(/id/)
  })

  it("throws on an invalid category", () => {
    const raw = `---
id: bad-cat
title: "Bad Category"
category: not_a_real_category
---
## Heading
Content.
`
    expect(() => parseKnowledgeMarkdown(raw, "bad.md")).toThrow(/category/)
  })

  it("splits the body into one chunk per H2 heading", () => {
    const body = "## Heading One\nContent one, repeated enough words to pad this out to a reasonable chunk length for the word-count check honestly this is filler text to hit fifty words minimum so the lint does not fire for this specific test case which only cares about chunk splitting not word count.\n\n## Heading Two\nContent two, repeated enough words to pad this out to a reasonable chunk length for the word-count check honestly this is filler text to hit fifty words minimum so the lint does not fire for this specific test case which only cares about chunk splitting not word count.\n"
    const { chunks } = parseKnowledgeMarkdown(makeDoc("", body), "test.md")
    expect(chunks).toHaveLength(2)
    expect(chunks[0].heading).toBe("Heading One")
    expect(chunks[0].chunkOrder).toBe(0)
    expect(chunks[1].heading).toBe("Heading Two")
    expect(chunks[1].chunkOrder).toBe(1)
  })

  it("computes estimatedTokens as ceil(content.length / 4)", () => {
    const { chunks } = parseKnowledgeMarkdown(makeDoc(), "test.md")
    expect(chunks[0].estimatedTokens).toBe(Math.ceil(chunks[0].content.length / 4))
  })

  it("warns (does not throw) when a chunk is outside the ~50-200 word target", () => {
    const { warnings } = parseKnowledgeMarkdown(makeDoc(), "test.md") // default body is a short 8-word chunk
    expect(warnings.some((w) => w.includes("outside the ~50-200"))).toBe(true)
  })

  it("warns on a duplicate H2 heading within one doc", () => {
    const body = "## Same Heading\nFirst version padded with enough filler words to clear the fifty word minimum check so only the duplicate-heading warning fires for this particular test case and nothing else about word count.\n\n## Same Heading\nSecond version padded with enough filler words to clear the fifty word minimum check so only the duplicate-heading warning fires for this particular test case and nothing else about word count.\n"
    const { warnings } = parseKnowledgeMarkdown(makeDoc("", body), "test.md")
    expect(warnings.some((w) => w.includes('duplicate H2 heading "Same Heading"'))).toBe(true)
  })

  it("warns when there's real content before the first H2 heading", () => {
    const raw = `---
id: preamble-doc
title: "Preamble Doc"
category: region
---

This is a stray paragraph that will never be retrievable.

## Heading
Content.
`
    const { warnings } = parseKnowledgeMarkdown(raw, "test.md")
    expect(warnings.some((w) => w.includes("not chunked"))).toBe(true)
  })

  it("does not warn about the H1 title line itself as stray preamble content", () => {
    const raw = `---
id: title-only-doc
title: "Title Only Doc"
category: region
---

# Title Only Doc

## Heading
Content here that is fine.
`
    const { warnings } = parseKnowledgeMarkdown(raw, "test.md")
    expect(warnings.some((w) => w.includes("not chunked"))).toBe(false)
  })

  it("warns when a doc has zero H2 sections", () => {
    const raw = `---
id: empty-doc
title: "Empty Doc"
category: region
---

# Empty Doc

Just a paragraph, no headings at all.
`
    const { chunks, warnings } = parseKnowledgeMarkdown(raw, "test.md")
    expect(chunks).toHaveLength(0)
    expect(warnings.some((w) => w.includes("zero retrievable chunks"))).toBe(true)
  })

  it("defaults version and weight when omitted, with a warning only on a genuinely invalid value", () => {
    const raw = `---
id: defaults-doc
title: "Defaults Doc"
category: region
weight: not-a-number
---
## Heading
Content padded with enough filler words to clear the fifty word minimum check so only the weight-default warning fires for this particular test case and nothing else about word count here at all.
`
    const { frontmatter, warnings } = parseKnowledgeMarkdown(raw, "test.md")
    expect(frontmatter.version).toBe(1)
    expect(frontmatter.weight).toBe(5)
    expect(warnings.some((w) => w.includes("weight"))).toBe(true)
  })

  it("strips the trailing UNVERIFIED disclosure line out of chunk content — it's for a human auditor, not the LLM prompt", () => {
    const body =
      "## Heading One\nGenuine guidance content padded with enough filler words to clear the fifty word minimum check so only the disclosure-stripping behavior is what this particular test case is actually verifying here today.\n\n## Heading Two\nMore genuine guidance content padded with enough filler words to clear the fifty word minimum check so only the disclosure-stripping behavior is what this test verifies.\n\n**UNVERIFIED — pending dietitian confirmation.**\n"
    const { chunks } = parseKnowledgeMarkdown(makeDoc("", body), "test.md")
    expect(chunks[1].content).not.toContain("UNVERIFIED")
    expect(chunks[1].content).toContain("More genuine guidance content")
  })

  it("prefixes every warning with the source file path", () => {
    const { warnings } = parseKnowledgeMarkdown(makeDoc(), "regions/punjabi.md")
    expect(warnings.length).toBeGreaterThan(0)
    for (const w of warnings) expect(w.startsWith("regions/punjabi.md: ")).toBe(true)
  })
})
