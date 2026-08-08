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
