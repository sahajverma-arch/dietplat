/**
 * Deterministic, LLM-free selection of which meal archetype (if any) fills
 * each slot on each day of the week. Sits between distributeMeals() and
 * eligibleFoodsForSkeleton() in the generation pipeline — same "pure
 * arithmetic, no AI, no I/O, reproducible" discipline as
 * exchange-solver.ts and meal-distributor.ts. Never touches an exchange
 * count or a macro number; its only output is which dish_families (if any)
 * should further narrow eligibility for a slot the rest of the pipeline
 * already solved.
 *
 * Returns null for any slot with no seeded archetype data, or when
 * `enabled` is false (the feature-flag kill switch — see env.ts's
 * ARCHETYPE_SELECTION_ENABLED, read by the caller, not by this module, so
 * this stays pure and independently testable). Every downstream consumer
 * already treats a null archetype as "behave exactly as before this layer
 * existed" — see eligible-foods.ts's dishFamilyIds?: undefined case.
 *
 * Same-day protein exclusion: `input.slots` is processed in order for each
 * day (breakfast..dinner, per meal_templates.slot_order), so a later slot
 * the same day already knows which dish families an earlier slot committed
 * to. Candidates whose protein-bearing components (pulse/meat/meat_lean)
 * would repeat one of those families are excluded, same graceful-degrade
 * shape as the cross-day RECENT_DAYS_AVOIDED filter below: if excluding
 * would empty the pool, the exclusion is dropped rather than forcing a
 * repeat's cost onto a broken generation. This is the archetype-level half
 * of the fix — see food-selector-fallback.ts's PROTEIN_EXCHANGE_TYPES for
 * the equivalent, independent safety net covering slots with no archetype
 * coverage at all.
 */

import type { ExchangeCode } from "./table-4-1"

const PROTEIN_EXCHANGE_TYPES = new Set<ExchangeCode>(["pulse", "meat", "meat_lean"])

/** Every dish_family id an archetype's protein-bearing components could serve — the set checked for same-day repetition. */
function proteinFamilyIds(components: ArchetypeComponentCandidate[]): Set<string> {
  const ids = new Set<string>()
  for (const component of components) {
    if (!PROTEIN_EXCHANGE_TYPES.has(component.exchangeType)) continue
    for (const id of component.dishFamilyIds) ids.add(id)
  }
  return ids
}

export interface ArchetypeComponentCandidate {
  role: string
  dishFamilyIds: string[]
  exchangeType: ExchangeCode
  isRequired: boolean
}

export interface ArchetypeCandidate {
  id: string
  code: string
  name: string
  authenticityScore: number
  components: ArchetypeComponentCandidate[]
}

export interface ArchetypeAssignment {
  slot: string
  archetypeId: string | null
  archetypeCode: string | null
  archetypeName: string | null
  components: ArchetypeComponentCandidate[]
}

export interface SelectArchetypesInput {
  slots: string[]
  /** Pre-loaded by the caller, already filtered to region + slot + dietType + is_active. */
  candidatesBySlot: Record<string, ArchetypeCandidate[]>
  /** Same concept and role as FoodSelectorInput.dayIndexOffset — advances rotation across weeks so week 2 doesn't restart at week 1's exact picks. 0 for a first-ever generation. */
  dayIndexOffset?: number
  /** Archetype ids used on the previous week's final days, by slot — mirrors previousWeekLastDay's role for food rotation. Omitted for a first-ever generation. */
  recentArchetypeIdsBySlot?: Record<string, string[]>
  /** The feature-flag kill switch, read by the caller from env.ts. false forces every slot to null, identical to having no archetype data at all. */
  enabled: boolean
}

/** How many of the most recent days (this week + carried over from last week) an archetype is excluded from repeating in the same slot, before the exclusion is relaxed rather than failing. */
const RECENT_DAYS_AVOIDED = 2

function stableHash(...parts: (string | number)[]): number {
  const str = parts.join("|")
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Deterministic weighted pick: build a cumulative-weight ladder over
 * `items` (in millis of weight, to stay in integer arithmetic), then land
 * on whichever rung a hash-derived value in [0, totalWeight) falls under.
 * No Math.random — the same seed always produces the same pick, matching
 * plan_generation_runs' reproducibility guarantee. Falls back to an
 * unweighted deterministic pick if every candidate's weight is 0.
 */
function weightedStablePick<T>(items: T[], weights: number[], seed: number): T {
  const totalWeightMillis = Math.round(weights.reduce((a, b) => a + b, 0) * 1000)
  if (totalWeightMillis <= 0) {
    return items[seed % items.length]
  }

  const point = seed % totalWeightMillis
  let cumulative = 0
  for (let i = 0; i < items.length; i++) {
    cumulative += Math.round(weights[i] * 1000)
    if (point < cumulative) return items[i]
  }
  return items[items.length - 1]
}

export function selectArchetypesForWeek(input: SelectArchetypesInput): ArchetypeAssignment[][] {
  const week: ArchetypeAssignment[][] = []
  const dayIndexOffset = input.dayIndexOffset ?? 0

  // Rolling per-slot history: seeded from cross-week continuity (dayIndex
  // -1 = "before this week", always inside the recency window at day 0),
  // then extended as this week's own days are decided — no external state
  // beyond what's passed in, mirroring the fallback food selector's
  // rotationDay = dayIndex + weekOffset approach to continuity.
  const recentBySlot = new Map<string, { dayIndex: number; archetypeId: string }[]>()
  if (input.recentArchetypeIdsBySlot) {
    for (const [slot, ids] of Object.entries(input.recentArchetypeIdsBySlot)) {
      recentBySlot.set(
        slot,
        ids.map((archetypeId) => ({ dayIndex: -1, archetypeId }))
      )
    }
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayAssignments: ArchetypeAssignment[] = []
    // Reset per day — families committed by an earlier slot THIS day only.
    const usedFamilyIdsToday = new Set<string>()

    for (const slot of input.slots) {
      const candidates = input.enabled ? (input.candidatesBySlot[slot] ?? []) : []

      if (candidates.length === 0) {
        dayAssignments.push({ slot, archetypeId: null, archetypeCode: null, archetypeName: null, components: [] })
        continue
      }

      const recent = recentBySlot.get(slot) ?? []
      const recentIds = new Set(
        recent.filter((r) => dayIndex - r.dayIndex <= RECENT_DAYS_AVOIDED).map((r) => r.archetypeId)
      )
      const recencySafe = candidates.filter((c) => !recentIds.has(c.id))
      const proteinSafe = candidates.filter((c) => {
        const ids = proteinFamilyIds(c.components)
        if (ids.size === 0) return true
        for (const id of ids) if (usedFamilyIdsToday.has(id)) return false
        return true
      })
      const recencySafeIds = new Set(recencySafe.map((c) => c.id))

      // Two independent soft constraints — weekly variety (recency) and
      // same-day protein repetition — each degrades on its own rather than
      // failing, but degrading naively (recency first, then protein) can
      // let recency accidentally strip out the ONE candidate that would
      // have avoided a same-day collision, and vice-versa. Tiered instead:
      // prefer satisfying both, then prefer breaking the same-day
      // collision (the harder complaint) over weekly freshness, then fall
      // back to weekly freshness alone, then give up both.
      let eligible = proteinSafe.filter((c) => recencySafeIds.has(c.id))
      if (eligible.length === 0) eligible = proteinSafe
      if (eligible.length === 0) eligible = recencySafe
      if (eligible.length === 0) eligible = candidates

      const seed = stableHash("archetype", slot, dayIndex, dayIndexOffset)
      const chosen = weightedStablePick(
        eligible,
        eligible.map((c) => c.authenticityScore),
        seed
      )

      dayAssignments.push({
        slot,
        archetypeId: chosen.id,
        archetypeCode: chosen.code,
        archetypeName: chosen.name,
        components: chosen.components,
      })

      const history = recentBySlot.get(slot) ?? []
      history.push({ dayIndex, archetypeId: chosen.id })
      recentBySlot.set(slot, history)

      for (const id of proteinFamilyIds(chosen.components)) usedFamilyIdsToday.add(id)
    }

    week.push(dayAssignments)
  }

  return week
}
