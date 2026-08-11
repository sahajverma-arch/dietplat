import { describe, expect, it } from "vitest"
import { distributeMeals, type MealSlotTemplate } from "./meal-distributor"
import type { ExchangeCounts } from "./table-4-1"
import { ZERO_COUNTS } from "./table-4-1"

/**
 * Mirrors the north_indian 5-meal template row in
 * 20260808200000_classic_table41_exchange_system.sql — keep in sync.
 */
const NORTH_INDIAN_TEMPLATES: MealSlotTemplate[] = [
  { slot: "breakfast", slotOrder: 1, kcalShare: 0.22, allowedExchangeTypes: ["cereal", "milk_cow", "milk_skim", "meat", "fruit", "fat", "sugar"] },
  { slot: "mid_morning", slotOrder: 2, kcalShare: 0.07, allowedExchangeTypes: ["fruit", "milk_cow", "fat"] },
  { slot: "lunch", slotOrder: 3, kcalShare: 0.26, allowedExchangeTypes: ["cereal", "pulse", "vegetable_a", "vegetable_b", "meat", "meat_lean", "fat", "milk_cow"] },
  { slot: "evening", slotOrder: 4, kcalShare: 0.19, allowedExchangeTypes: ["fruit", "fat", "milk_cow", "cereal"] },
  { slot: "dinner", slotOrder: 5, kcalShare: 0.26, allowedExchangeTypes: ["cereal", "pulse", "vegetable_a", "vegetable_b", "meat", "meat_lean", "fat"] },
]

function totalOf(skeleton: ReturnType<typeof distributeMeals>, exchangeType: string): number {
  return Object.values(skeleton)
    .flat()
    .filter((item) => item.exchangeType === exchangeType)
    .reduce((sum, item) => sum + item.count, 0)
}

describe("distributeMeals — Deepak Sharma's real decoded skeleton", () => {
  // 18 cereal, 2 milk_cow, 2 pulse, 3 vegetable_a, 2 vegetable_b, 6 fruit,
  // 11 fat — reproduces his real plan exactly (see exchange-solver.test.ts).
  const counts: ExchangeCounts = {
    ...ZERO_COUNTS,
    cereal: 18,
    milk_cow: 2,
    pulse: 2,
    vegetable_a: 3,
    vegetable_b: 2,
    fruit: 6,
    fat: 11,
  }
  const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)

  it("conserves every exchange type's total exactly across all slots", () => {
    for (const [code, total] of Object.entries(counts)) {
      if (!total) continue
      expect(totalOf(skeleton, code), code).toBe(total)
    }
  })

  it("never places an exchange type in a slot that doesn't allow it", () => {
    for (const template of NORTH_INDIAN_TEMPLATES) {
      for (const item of skeleton[template.slot]) {
        expect(template.allowedExchangeTypes, `${template.slot} should allow ${item.exchangeType}`).toContain(
          item.exchangeType
        )
      }
    }
  })

  it("cereal distribution stays within 1 exchange of the real plan's split (4/1/5/3/5) at every slot", () => {
    // Exact tie-breaking inside the real system's own distributor isn't
    // documented anywhere — this checks proportionality lands in the same
    // neighbourhood, not a bit-exact reproduction of unknown internals.
    const real: Record<string, number> = { breakfast: 4, mid_morning: 1, lunch: 5, evening: 3, dinner: 5 }
    for (const t of NORTH_INDIAN_TEMPLATES) {
      const got = skeleton[t.slot].find((item) => item.exchangeType === "cereal")?.count ?? 0
      expect(Math.abs(got - real[t.slot]), t.slot).toBeLessThanOrEqual(1)
    }
  })

  it("pulse only appears at lunch and dinner, never mid-morning", () => {
    expect(skeleton.mid_morning.some((i) => i.exchangeType === "pulse")).toBe(false)
    const pulseLunch = skeleton.lunch.find((i) => i.exchangeType === "pulse")?.count ?? 0
    const pulseDinner = skeleton.dinner.find((i) => i.exchangeType === "pulse")?.count ?? 0
    expect(pulseLunch + pulseDinner).toBe(2)
  })

  it("every slot is present, even ones with zero items of some type", () => {
    expect(Object.keys(skeleton).sort()).toEqual(
      ["breakfast", "mid_morning", "lunch", "evening", "dinner"].sort()
    )
  })
})

describe("distributeMeals — meat, meat_lean, milk_cow, milk_skim are indivisible, never split across slots", () => {
  it("puts the full meat (egg) count in one slot, not fractioned across several", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat: 2, cereal: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    const slotsWithMeat = Object.entries(skeleton).filter(([, items]) => items.some((i) => i.exchangeType === "meat"))
    expect(slotsWithMeat).toHaveLength(1)
    expect(slotsWithMeat[0][0]).toBe("breakfast")
    expect(slotsWithMeat[0][1].find((i) => i.exchangeType === "meat")?.count).toBe(2)
  })

  it("puts the full meat_lean (chicken/fish) count in one slot — dinner specifically, a dietitian directive, not just the earliest allowed slot", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, cereal: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    const slotsWithMeatLean = Object.entries(skeleton).filter(([, items]) => items.some((i) => i.exchangeType === "meat_lean"))
    expect(slotsWithMeatLean).toHaveLength(1)
    expect(slotsWithMeatLean[0][0]).toBe("dinner")
    expect(slotsWithMeatLean[0][1].find((i) => i.exchangeType === "meat_lean")?.count).toBe(2)
  })

  it("meat and meat_lean can land in the same day without interfering with each other", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat: 2, meat_lean: 1, cereal: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    expect(totalOf(skeleton, "meat")).toBe(2)
    expect(totalOf(skeleton, "meat_lean")).toBe(1)
  })

  it("puts the full milk_cow count in one slot — no more 125 ml glass + 125 ml folded into evening chai", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, milk_cow: 1, cereal: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    const slotsWithMilk = Object.entries(skeleton).filter(([, items]) => items.some((i) => i.exchangeType === "milk_cow"))
    expect(slotsWithMilk).toHaveLength(1)
    expect(slotsWithMilk[0][0]).toBe("breakfast")
    expect(slotsWithMilk[0][1].find((i) => i.exchangeType === "milk_cow")?.count).toBe(1)
  })

  it("puts the full milk_skim count in one slot", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, milk_skim: 1, cereal: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    const slotsWithMilkSkim = Object.entries(skeleton).filter(([, items]) => items.some((i) => i.exchangeType === "milk_skim"))
    expect(slotsWithMilkSkim).toHaveLength(1)
    expect(slotsWithMilkSkim[0][0]).toBe("breakfast")
  })
})

describe("distributeMeals — a meal with meat/meat_lean gets no dal or sabzi alongside it", () => {
  it("routes all pulse away from meat_lean's slot to the other allowed slot", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, pulse: 2, cereal: 8 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    // meat_lean always lands at dinner now (a dietitian directive) — see the indivisible-types tests above.
    expect(skeleton.dinner.some((i) => i.exchangeType === "pulse")).toBe(false)
    expect(skeleton.lunch.find((i) => i.exchangeType === "pulse")?.count).toBe(2)
  })

  it("routes all vegetable_a and vegetable_b away from meat_lean's slot too", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, vegetable_a: 4, vegetable_b: 2, cereal: 8 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    expect(skeleton.dinner.some((i) => i.exchangeType === "vegetable_a" || i.exchangeType === "vegetable_b")).toBe(false)
    expect(skeleton.lunch.find((i) => i.exchangeType === "vegetable_a")?.count).toBe(4)
    expect(skeleton.lunch.find((i) => i.exchangeType === "vegetable_b")?.count).toBe(2)
  })

  it("still allows cereal and fat alongside meat_lean in the same slot", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, cereal: 8, fat: 4 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    expect(skeleton.dinner.some((i) => i.exchangeType === "cereal")).toBe(true)
    expect(skeleton.dinner.some((i) => i.exchangeType === "fat")).toBe(true)
  })

  it("conserves totals exactly even with the exclusion in play", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, pulse: 2, vegetable_a: 4, vegetable_b: 2, cereal: 8 }
    const skeleton = distributeMeals(counts, NORTH_INDIAN_TEMPLATES)
    expect(totalOf(skeleton, "pulse")).toBe(2)
    expect(totalOf(skeleton, "vegetable_a")).toBe(4)
    expect(totalOf(skeleton, "vegetable_b")).toBe(2)
  })

  it("does not exclude a slot if doing so would leave pulse/vegetable nowhere to go", () => {
    // pulse's only allowed slot is dinner, the same slot meat_lean now
    // always anchors to (the last allowed slot) — the exclusion must be
    // skipped rather than throwing.
    const templates: MealSlotTemplate[] = [
      { slot: "lunch", slotOrder: 1, kcalShare: 0.5, allowedExchangeTypes: ["cereal", "meat_lean", "fat"] },
      { slot: "dinner", slotOrder: 2, kcalShare: 0.5, allowedExchangeTypes: ["cereal", "pulse", "meat_lean", "fat"] },
    ]
    const counts: ExchangeCounts = { ...ZERO_COUNTS, meat_lean: 2, pulse: 2, cereal: 4 }
    expect(() => distributeMeals(counts, templates)).not.toThrow()
    const skeleton = distributeMeals(counts, templates)
    expect(totalOf(skeleton, "pulse")).toBe(2)
  })
})

describe("distributeMeals — throws rather than silently dropping exchanges", () => {
  it("throws when an exchange type has no allowed slot anywhere", () => {
    const counts: ExchangeCounts = { ...ZERO_COUNTS, sugar: 1 }
    const templatesWithoutSugar = NORTH_INDIAN_TEMPLATES.map((t) => ({
      ...t,
      allowedExchangeTypes: t.allowedExchangeTypes.filter((c) => c !== "sugar"),
    }))
    expect(() => distributeMeals(counts, templatesWithoutSugar)).toThrow()
  })
})
