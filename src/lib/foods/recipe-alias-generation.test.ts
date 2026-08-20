import { describe, expect, it } from "vitest"

import { generateAliasCandidates, resolveAliasCollisions } from "./recipe-alias-generation"

describe("generateAliasCandidates", () => {
  it("strips a parenthetical qualifier", () => {
    expect(generateAliasCandidates("Rajma Chawal (Kidney Bean Curry with Rice)")).toContain("Rajma Chawal")
  })

  it("swaps & for and and vice versa", () => {
    expect(generateAliasCandidates("Dal & Rice")).toContain("Dal and Rice")
    expect(generateAliasCandidates("Dal and Rice")).toContain("Dal & Rice")
  })

  it("generates a simple plural/singular variant", () => {
    expect(generateAliasCandidates("Aloo Paratha")).toContain("Aloo Parathas")
    expect(generateAliasCandidates("Vegetable Sticks")).toContain("Vegetable Stick")
  })

  it("never includes the original name itself", () => {
    expect(generateAliasCandidates("Aloo Paratha")).not.toContain("Aloo Paratha")
  })
})

describe("resolveAliasCollisions", () => {
  it("assigns non-colliding aliases normally", () => {
    const recipes = [{ id: "1", name: "Aloo Paratha" }]
    const { aliases, dropped } = resolveAliasCollisions(recipes)
    expect(aliases.some((a) => a.alias === "Aloo Parathas")).toBe(true)
    expect(dropped).toEqual([])
  })

  it("drops an alias that would collide with another recipe's own real name", () => {
    const recipes = [
      { id: "1", name: "Aloo Parathas" },
      { id: "2", name: "Aloo Paratha" },
    ]
    const { aliases } = resolveAliasCollisions(recipes)
    // "Aloo Paratha"'s singular-plural alias "Aloo Parathas" collides with
    // recipe 1's own real name — must not be assigned to recipe 2.
    expect(aliases.find((a) => a.recipeId === "2" && a.alias === "Aloo Parathas")).toBeUndefined()
  })

  it("drops an alias two different recipes would both generate, reporting it", () => {
    const recipes = [
      { id: "1", name: "Chicken Curry (Spicy)" },
      { id: "2", name: "Chicken Curry (Mild)" },
    ]
    const { aliases, dropped } = resolveAliasCollisions(recipes)
    // Both strip to "Chicken Curry" — ambiguous, must be dropped for both.
    expect(aliases.some((a) => a.alias === "Chicken Curry")).toBe(false)
    expect(dropped.some((d) => d.alias === "Chicken Curry")).toBe(true)
  })
})
