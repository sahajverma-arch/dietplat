import { describe, expect, it } from "vitest"

import {
  FAT_SHARE_HEADROOM,
  MIN_POOL_AFTER_FAT_FILTER,
  fatShareOfKcal,
  filterByFatShare,
  filterRecipePool,
  isNutritionallyEmpty,
  targetFatShare,
  type PoolFilterRecipe,
} from "./recipe-pool-filters"
import type { DailyRecipeTarget } from "../plan/recipe-types"

/** The real target from the rejected week: fat is 25% of calories. */
const TARGET: DailyRecipeTarget = { kcal: 2030, proteinG: 90, carbsG: 290, fatG: 56, fiberG: 30 }

function recipe(name: string, category: string, kcalPer100G: number, fatPer100G: number): PoolFilterRecipe {
  return { name, category, kcalPer100G, fatPer100G }
}

/** Filler so the fat filter is not suppressed by its own minimum-pool guard. */
function padding(n: number): PoolFilterRecipe[] {
  return Array.from({ length: n }, (_, i) => recipe(`Filler ${i}`, "Sabzi", 150, 2))
}

describe("isNutritionallyEmpty", () => {
  it("drops placeholder rows that are not dishes", () => {
    // Both real rows, both plated to a dietitian as "Any Veg (150 g)".
    expect(isNutritionallyEmpty(recipe("Any Veg", "Sabzi", 0, 0))).toBe(true)
    expect(isNutritionallyEmpty(recipe("Any Veg (W/O Aloo, Arbi, Paneer, Soy)", "Sabzi", 0, 0))).toBe(true)
  })

  it("drops food rows whose calories are simply wrong", () => {
    // Real ingested rows. Worse than placeholders: the balancer will serve
    // 250g of these and count zero macros against the day's target.
    expect(isNutritionallyEmpty(recipe("Watermelon", "Fruit", 0, 0))).toBe(true)
    expect(isNutritionallyEmpty(recipe("Moong Dal Idli", "Idli", 0, 0))).toBe(true)
    expect(isNutritionallyEmpty(recipe("Kandi Pachadi (Toor Dal Chutney)", "Chutney", 0, 0))).toBe(true)
  })

  it("KEEPS drinks that are legitimately zero-calorie", () => {
    expect(isNutritionallyEmpty(recipe("Lukewarm Water", "Morning Water", 0, 0))).toBe(false)
    expect(isNutritionallyEmpty(recipe("Apple Cider Vinegar", "Morning Water", 0, 0))).toBe(false)
    expect(isNutritionallyEmpty(recipe("Extreme Weight Loss Green Tea", "Tea", 0, 0))).toBe(false)
  })

  it("keeps any row that declares real energy", () => {
    expect(isNutritionallyEmpty(recipe("Roti", "Roti", 157, 0.8))).toBe(false)
  })
})

describe("fatShareOfKcal / targetFatShare", () => {
  it("computes fat's share of calories", () => {
    // 10g fat = 90 kcal of a 300 kcal dish
    expect(fatShareOfKcal(recipe("X", "Sabzi", 300, 10))).toBeCloseTo(0.3, 6)
  })

  it("reads the client's target share", () => {
    expect(targetFatShare(TARGET)).toBeCloseTo(0.248, 3)
  })

  it("does not divide by zero on a zero-calorie drink", () => {
    expect(fatShareOfKcal(recipe("Water", "Morning Water", 0, 0))).toBe(0)
  })
})

describe("filterByFatShare", () => {
  it("keeps a dish at the client's own fat share", () => {
    const onTarget = recipe("Dal", "Dal", 200, 5.5) // ~25%
    const kept = filterByFatShare([onTarget, ...padding(MIN_POOL_AFTER_FAT_FILTER)], TARGET)
    expect(kept).toContain(onTarget)
  })

  it("keeps a dish inside the headroom but excludes one past it", () => {
    const ceiling = targetFatShare(TARGET) * FAT_SHARE_HEADROOM
    const justInside = recipe("Inside", "Sabzi", 200, ((ceiling - 0.02) * 200) / 9)
    const justOutside = recipe("Outside", "Sabzi", 200, ((ceiling + 0.02) * 200) / 9)
    const kept = filterByFatShare([justInside, justOutside, ...padding(MIN_POOL_AFTER_FAT_FILTER)], TARGET)
    expect(kept).toContain(justInside)
    expect(kept).not.toContain(justOutside)
  })

  it("excludes the real calorie-dense outliers the model kept reaching for", () => {
    const walnut = recipe("Walnut", "Nuts", 654, 65) // ~89% of calories from fat
    const kept = filterByFatShare([walnut, ...padding(MIN_POOL_AFTER_FAT_FILTER)], TARGET)
    expect(kept).not.toContain(walnut)
  })

  it("keeps carb-dense low-fat dishes, which is the point", () => {
    // Real row: the plans were short on carbs, so these must survive.
    const roti = recipe("Jaun Stuffed Roti ( Except Aalu, Paneer)", "Roti", 157.2, 0.8)
    const kept = filterByFatShare([roti, ...padding(MIN_POOL_AFTER_FAT_FILTER)], TARGET)
    expect(kept).toContain(roti)
  })

  it("degrades to the unfiltered pool rather than starving the model", () => {
    const fatty = [recipe("A", "Nuts", 600, 60), recipe("B", "Nuts", 600, 60)]
    expect(filterByFatShare(fatty, TARGET)).toEqual(fatty)
  })

  it("narrows almost nothing for a genuinely high-fat prescription", () => {
    const keto: DailyRecipeTarget = { kcal: 2000, proteinG: 100, carbsG: 50, fatG: 155, fiberG: 20 }
    const pool = [recipe("Cream Curry", "Curry", 300, 25), ...padding(MIN_POOL_AFTER_FAT_FILTER)]
    expect(filterByFatShare(pool, keto)).toHaveLength(pool.length)
  })
})

describe("filterRecipePool", () => {
  it("drops empty rows even when the fat filter declines to narrow", () => {
    // Too small a pool for the fat filter, so it degrades — but "Any Veg"
    // must still go, because that filter is unconditional.
    const pool = [recipe("Any Veg", "Sabzi", 0, 0), recipe("Walnut", "Nuts", 654, 65)]
    const kept = filterRecipePool(pool, TARGET)
    expect(kept.map((r) => r.name)).toEqual(["Walnut"])
  })
})
