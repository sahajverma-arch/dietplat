/**
 * Splits a raw comma-separated CSV pairing cell ("Pulao, Khichdi, Biryani")
 * into a trimmed, deduped, order-preserving list of tokens. Shared by all
 * four pairing columns (Must/Good-to-have x Category/Recipe) — see
 * recipe-csv-parser.ts's MUST_HAVE_CATEGORY/GOOD_TO_HAVE_CATEGORY/
 * MUST_HAVE_RECIPE/GOOD_TO_HAVE_RECIPE columns. Deliberately no attempt to
 * resolve a token against a real Category value or recipe name here — that
 * happens downstream (recipe-pairing.ts), case-insensitively, so a raw
 * casing/whitespace variant ("Rice+ Curry" vs "Curry + Rice") doesn't need
 * to be fixed at ingestion to still work at match time.
 */

export function parsePairingList(raw: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const part of raw.split(",")) {
    const cleaned = part.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(cleaned)
  }
  return tokens
}
