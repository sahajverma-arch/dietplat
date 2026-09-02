import { describe, expect, it } from "vitest"

import { findPairingCompanion, isMustHaveSatisfied } from "./recipe-pairing"
import { makeRecipe } from "./test-fixtures"
import type { RecipeForPrompt } from "./recipe-types"

// makeRecipe() returns the full DB `Recipe` shape, whose mainOrMid is a
// plain `string` (unconstrained at the DB layer) rather than RecipeForPrompt's
// narrower "main" | "mid" literal — same cast route.ts's own mapping uses.
function rp(r: ReturnType<typeof makeRecipe>): RecipeForPrompt {
  return r as unknown as RecipeForPrompt
}

describe("isMustHaveSatisfied", () => {
  it("is satisfied (true) when the item declares no must-have requirement", () => {
    const item = makeRecipe({ mustHaveCategories: [], mustHaveRecipeNames: [] })
    expect(isMustHaveSatisfied(item, [], [])).toBe(true)
  })

  it("is satisfied when a sibling's category matches a must-have category", () => {
    const item = makeRecipe({ mustHaveCategories: ["Pulao", "Khichdi", "Biryani"] })
    expect(isMustHaveSatisfied(item, ["Pulao"], [])).toBe(true)
  })

  it("matches category case-insensitively", () => {
    const item = makeRecipe({ mustHaveCategories: ["Pulao"] })
    expect(isMustHaveSatisfied(item, ["pulao"], [])).toBe(true)
  })

  it("is satisfied when a sibling's name matches a must-have recipe name", () => {
    const item = makeRecipe({ mustHaveRecipeNames: ["Mint Chutney", "Coriander Chutney"] })
    expect(isMustHaveSatisfied(item, [], ["Coriander Chutney"])).toBe(true)
  })

  it("is NOT satisfied when no sibling matches either list", () => {
    const item = makeRecipe({ mustHaveCategories: ["Pulao"], mustHaveRecipeNames: ["Mint Chutney"] })
    expect(isMustHaveSatisfied(item, ["Sabzi"], ["Roti"])).toBe(false)
  })
})

describe("findPairingCompanion", () => {
  it("finds a real candidate from the pool matching a category", () => {
    const pulao = makeRecipe({ name: "Veg Pulao", category: "Pulao" })
    const other = makeRecipe({ name: "Roti", category: "Bread" })
    const found = findPairingCompanion([pulao, other].map(rp), ["Pulao", "Khichdi"], [], 0, new Set())
    expect(found?.name).toBe("Veg Pulao")
  })

  it("finds a real candidate from the pool matching a recipe name", () => {
    const chutney = makeRecipe({ name: "Mint Chutney", category: "Chutney" })
    const found = findPairingCompanion([chutney].map(rp), [], ["Mint Chutney"], 0, new Set())
    expect(found?.name).toBe("Mint Chutney")
  })

  it("returns null when the pool has no eligible companion", () => {
    const other = makeRecipe({ name: "Roti", category: "Bread" })
    expect(findPairingCompanion([other].map(rp), ["Pulao"], [], 0, new Set())).toBeNull()
  })

  it("excludes names already in the excluded set", () => {
    const pulao = makeRecipe({ name: "Veg Pulao", category: "Pulao" })
    expect(findPairingCompanion([pulao].map(rp), ["Pulao"], [], 0, new Set(["veg pulao"]))).toBeNull()
  })

  it("rotates deterministically across multiple eligible candidates via the rotation index", () => {
    const a = makeRecipe({ name: "Veg Pulao", category: "Pulao" })
    const b = makeRecipe({ name: "Khichdi", category: "Khichdi" })
    const first = findPairingCompanion([a, b].map(rp), ["Pulao", "Khichdi"], [], 0, new Set())
    const second = findPairingCompanion([a, b].map(rp), ["Pulao", "Khichdi"], [], 1, new Set())
    expect(first?.name).toBe("Veg Pulao")
    expect(second?.name).toBe("Khichdi")
  })
})
