/**
 * Deterministic (not LLM-generated) alias candidates for a recipe name —
 * cheap, reproducible, auditable, run once at ingestion time. Feeds the
 * `recipe_aliases` table, which the grounding resolver's alias tier matches
 * against in addition to a recipe's own exact name (see
 * recipe-grounding.ts).
 */

function stripParenthetical(name: string): string | null {
  const stripped = name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped && stripped !== name ? stripped : null
}

function swapAmpersandAndAnd(name: string): string[] {
  const out: string[] = []
  if (name.includes("&")) out.push(name.replace(/&/g, "and").replace(/\s+/g, " ").trim())
  if (/\band\b/i.test(name)) out.push(name.replace(/\band\b/gi, "&").replace(/\s+/g, " ").trim())
  return out
}

function simplePlural(name: string): string[] {
  const trimmed = name.trim()
  const out: string[] = []
  if (!trimmed.toLowerCase().endsWith("s")) out.push(`${trimmed}s`)
  if (trimmed.toLowerCase().endsWith("s") && !trimmed.toLowerCase().endsWith("ss")) out.push(trimmed.slice(0, -1))
  return out
}

export function generateAliasCandidates(name: string): string[] {
  const candidates = new Set<string>()
  const parenStripped = stripParenthetical(name)
  if (parenStripped) {
    candidates.add(parenStripped)
    for (const c of swapAmpersandAndAnd(parenStripped)) candidates.add(c)
  }
  for (const c of swapAmpersandAndAnd(name)) candidates.add(c)
  for (const c of simplePlural(name)) candidates.add(c)
  candidates.delete(name)
  return [...candidates].filter((c) => c.trim().length > 0)
}

export interface RecipeForAliasing {
  id: string
  name: string
}

export interface GeneratedAlias {
  recipeId: string
  alias: string
}

/**
 * Resolves cross-recipe alias collisions: if a generated alias would match
 * more than one recipe (collides with another recipe's own exact name, or
 * with an alias already claimed by a different recipe), it's dropped
 * entirely — never inserted, and never guessed at — so the grounding
 * resolver's alias tier can never resolve ambiguously.
 */
export function resolveAliasCollisions(recipes: RecipeForAliasing[]): {
  aliases: GeneratedAlias[]
  dropped: { alias: string; recipeIds: string[] }[]
} {
  const nameToRecipeId = new Map<string, string>()
  for (const r of recipes) nameToRecipeId.set(r.name.toLowerCase(), r.id)

  const claimedBy = new Map<string, Set<string>>()
  const proposals: GeneratedAlias[] = []
  for (const r of recipes) {
    for (const alias of generateAliasCandidates(r.name)) {
      const key = alias.toLowerCase()
      const ownerOfSameName = nameToRecipeId.get(key)
      if (ownerOfSameName && ownerOfSameName !== r.id) continue // collides with another recipe's real name — the real name always wins, nothing to report
      proposals.push({ recipeId: r.id, alias })
      const set = claimedBy.get(key) ?? new Set<string>()
      set.add(r.id)
      claimedBy.set(key, set)
    }
  }

  const aliases: GeneratedAlias[] = []
  const dropped: { alias: string; recipeIds: string[] }[] = []
  const reported = new Set<string>()
  for (const p of proposals) {
    const key = p.alias.toLowerCase()
    const claimants = claimedBy.get(key)!
    if (claimants.size > 1) {
      if (!reported.has(key)) {
        dropped.push({ alias: p.alias, recipeIds: [...claimants] })
        reported.add(key)
      }
      continue
    }
    aliases.push(p)
  }
  return { aliases, dropped }
}
