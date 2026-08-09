import { describe, expect, it } from "vitest"

import { selectArchetypesForWeek, type ArchetypeCandidate, type SelectArchetypesInput } from "./archetype-selector"

const idliSambar: ArchetypeCandidate = {
  id: "idli-sambar",
  code: "south_indian_idli_sambar",
  name: "Idli with Sambar",
  authenticityScore: 1.0,
  components: [
    { role: "steamed_batter_cereal", dishFamilyIds: ["idli-family"], exchangeType: "cereal", isRequired: true },
    { role: "lentil_curry", dishFamilyIds: ["sambar-family"], exchangeType: "pulse", isRequired: true },
  ],
}

const dosaSambar: ArchetypeCandidate = {
  id: "dosa-sambar",
  code: "south_indian_dosa_sambar",
  name: "Dosa with Sambar",
  authenticityScore: 0.4,
  components: [
    { role: "fermented_crepe_cereal", dishFamilyIds: ["dosa-family"], exchangeType: "cereal", isRequired: true },
    { role: "lentil_curry", dishFamilyIds: ["sambar-family"], exchangeType: "pulse", isRequired: true },
  ],
}

function baseInput(overrides: Partial<SelectArchetypesInput> = {}): SelectArchetypesInput {
  return {
    slots: ["breakfast"],
    candidatesBySlot: { breakfast: [idliSambar, dosaSambar] },
    dayIndexOffset: 0,
    enabled: true,
    ...overrides,
  }
}

describe("selectArchetypesForWeek — determinism", () => {
  it("produces identical output for identical input", () => {
    const a = selectArchetypesForWeek(baseInput())
    const b = selectArchetypesForWeek(baseInput())
    expect(a).toEqual(b)
  })

  it("produces 7 days, each with one assignment per requested slot", () => {
    const week = selectArchetypesForWeek(baseInput({ slots: ["breakfast", "lunch"] }))
    expect(week).toHaveLength(7)
    for (const day of week) {
      expect(day.map((a) => a.slot).sort()).toEqual(["breakfast", "lunch"])
    }
  })

  it("never calls Math.random — same seed inputs always reproduce the same picks across independent calls", () => {
    const runs = Array.from({ length: 5 }, () => selectArchetypesForWeek(baseInput()))
    for (const run of runs.slice(1)) {
      expect(run).toEqual(runs[0])
    }
  })
})

describe("selectArchetypesForWeek — null when no data / disabled", () => {
  it("returns archetypeId: null for a slot with no candidates", () => {
    const week = selectArchetypesForWeek(baseInput({ slots: ["breakfast", "dinner"], candidatesBySlot: { breakfast: [idliSambar] } }))
    for (const day of week) {
      const dinner = day.find((a) => a.slot === "dinner")!
      expect(dinner.archetypeId).toBeNull()
      expect(dinner.components).toEqual([])
    }
  })

  it("returns archetypeId: null everywhere when enabled is false, even with real candidates present", () => {
    const week = selectArchetypesForWeek(baseInput({ enabled: false }))
    for (const day of week) {
      for (const assignment of day) {
        expect(assignment.archetypeId).toBeNull()
      }
    }
  })
})

describe("selectArchetypesForWeek — weighted rotation", () => {
  it("over many independent seeds, a much-higher-authenticity candidate is picked strictly more often — sampled at day 0 only, which is never affected by the recency-avoidance history mechanic (see the repeat-avoidance tests for that interaction)", () => {
    const heavilyFavoured: ArchetypeCandidate = { ...idliSambar, authenticityScore: 1.0 }
    const rarelyPicked: ArchetypeCandidate = { ...dosaSambar, authenticityScore: 0.02 }
    const counts = { [heavilyFavoured.id]: 0, [rarelyPicked.id]: 0 }
    for (let offset = 0; offset < 300; offset++) {
      const week = selectArchetypesForWeek(
        baseInput({ dayIndexOffset: offset, candidatesBySlot: { breakfast: [heavilyFavoured, rarelyPicked] } })
      )
      const id = week[0][0].archetypeId
      if (id) counts[id] += 1
    }
    expect(counts[heavilyFavoured.id]).toBeGreaterThan(counts[rarelyPicked.id])
  })

  it("a single candidate with authenticityScore 0 is still selectable (falls back to unweighted pick, never throws or hangs)", () => {
    const zeroScore: ArchetypeCandidate = { ...idliSambar, authenticityScore: 0 }
    const week = selectArchetypesForWeek(baseInput({ candidatesBySlot: { breakfast: [zeroScore] } }))
    expect(week.every((day) => day[0].archetypeId === zeroScore.id)).toBe(true)
  })
})

describe("selectArchetypesForWeek — weekly variety / repeat avoidance", () => {
  it("does not repeat an archetype within the recent-days window when enough alternatives exist", () => {
    // 3 candidates with a 2-day avoidance window: the excluded set can
    // never cover all 3 (it holds at most the last 2 days' picks), so
    // eligible never falls back to the full pool and every day is
    // guaranteed to differ from its immediate predecessor, all week.
    const puttuKadala: ArchetypeCandidate = {
      id: "puttu-kadala",
      code: "south_indian_puttu_kadala",
      name: "Puttu with Kadala Curry",
      authenticityScore: 0.6,
      components: [
        { role: "steamed_cereal", dishFamilyIds: ["puttu-family"], exchangeType: "cereal", isRequired: true },
        { role: "lentil_curry", dishFamilyIds: ["kadala-family"], exchangeType: "pulse", isRequired: true },
      ],
    }
    const week = selectArchetypesForWeek(
      baseInput({ candidatesBySlot: { breakfast: [idliSambar, dosaSambar, puttuKadala] } })
    )
    for (let d = 1; d < 7; d++) {
      expect(week[d][0].archetypeId).not.toBe(week[d - 1][0].archetypeId)
    }
  })

  it("with only 2 candidates and a 2-day window, day 1 always differs from day 0 (the one pair the pool size can always guarantee)", () => {
    const week = selectArchetypesForWeek(baseInput())
    expect(week[1][0].archetypeId).not.toBe(week[0][0].archetypeId)
  })

  it("allows a repeat once the candidate pool is exhausted rather than failing", () => {
    const week = selectArchetypesForWeek(baseInput({ candidatesBySlot: { breakfast: [idliSambar] } }))
    expect(week.every((day) => day[0].archetypeId === idliSambar.id)).toBe(true)
  })

  it("honours recentArchetypeIdsBySlot carried over from the previous week — day 0 avoids it when an alternative exists", () => {
    const week = selectArchetypesForWeek(
      baseInput({ recentArchetypeIdsBySlot: { breakfast: [idliSambar.id] } })
    )
    expect(week[0][0].archetypeId).toBe(dosaSambar.id)
  })
})

describe("selectArchetypesForWeek — same-day protein exclusion", () => {
  const rajmaChawal: ArchetypeCandidate = {
    id: "rajma-chawal",
    code: "north_indian_rajma_chawal",
    name: "Rajma Chawal",
    authenticityScore: 1.0,
    components: [
      { role: "rice_cereal", dishFamilyIds: ["rice-family"], exchangeType: "cereal", isRequired: true },
      { role: "lentil_curry", dishFamilyIds: ["rajma-family"], exchangeType: "pulse", isRequired: true },
    ],
  }
  const rajmaRoti: ArchetypeCandidate = {
    id: "rajma-roti",
    code: "north_indian_rajma_roti",
    name: "Rajma Roti",
    authenticityScore: 1.0,
    components: [
      { role: "roti_cereal", dishFamilyIds: ["roti-family"], exchangeType: "cereal", isRequired: true },
      // Same pulse family as rajma-chawal — the collision this filter exists to prevent.
      { role: "lentil_curry", dishFamilyIds: ["rajma-family"], exchangeType: "pulse", isRequired: true },
    ],
  }
  const moongRoti: ArchetypeCandidate = {
    id: "moong-roti",
    code: "north_indian_moong_roti",
    name: "Moong Roti",
    authenticityScore: 0.01, // deliberately low — proves exclusion overrides weighting, not just luck
    components: [
      { role: "roti_cereal", dishFamilyIds: ["roti-family"], exchangeType: "cereal", isRequired: true },
      { role: "lentil_curry", dishFamilyIds: ["moong-family"], exchangeType: "pulse", isRequired: true },
    ],
  }
  const vegetableKurma: ArchetypeCandidate = {
    id: "vegetable-kurma",
    code: "south_indian_vegetable_kurma_meal",
    name: "Vegetable Kurma Meal",
    authenticityScore: 1.0,
    components: [
      { role: "rice_cereal", dishFamilyIds: ["rice-family"], exchangeType: "cereal", isRequired: true },
      { role: "coconut_fat", dishFamilyIds: ["coconut-family"], exchangeType: "fat", isRequired: false },
    ],
  }

  function twoSlotInput(dinnerCandidates: ArchetypeCandidate[]): SelectArchetypesInput {
    return baseInput({
      slots: ["lunch", "dinner"],
      candidatesBySlot: { lunch: [rajmaChawal], dinner: dinnerCandidates },
    })
  }

  it("excludes a same-day archetype whose pulse family repeats an earlier slot's choice, even when it's the heavily-favoured candidate", () => {
    const week = selectArchetypesForWeek(twoSlotInput([rajmaRoti, moongRoti]))
    for (const day of week) {
      const lunch = day.find((a) => a.slot === "lunch")!
      const dinner = day.find((a) => a.slot === "dinner")!
      expect(lunch.archetypeId).toBe(rajmaChawal.id)
      expect(dinner.archetypeId).toBe(moongRoti.id)
    }
  })

  it("degrades gracefully to a repeat when the only same-day candidate shares the used family", () => {
    const week = selectArchetypesForWeek(twoSlotInput([rajmaRoti]))
    for (const day of week) {
      const dinner = day.find((a) => a.slot === "dinner")!
      expect(dinner.archetypeId).toBe(rajmaRoti.id)
    }
  })

  it("never excludes a candidate with no protein-bearing component (e.g. a coconut-fat-only archetype)", () => {
    const week = selectArchetypesForWeek(twoSlotInput([vegetableKurma]))
    for (const day of week) {
      const dinner = day.find((a) => a.slot === "dinner")!
      expect(dinner.archetypeId).toBe(vegetableKurma.id)
    }
  })

  it("is deterministic with same-day exclusion active", () => {
    const a = selectArchetypesForWeek(twoSlotInput([rajmaRoti, moongRoti]))
    const b = selectArchetypesForWeek(twoSlotInput([rajmaRoti, moongRoti]))
    expect(a).toEqual(b)
  })
})
