import { describe, expect, it } from "vitest"

import { classifyRecipeDietTypes } from "./recipe-diet-classifier"

describe("classifyRecipeDietTypes", () => {
  it("VEGAN, VEGETARIAN is safe for everyone (vegetarian, eggetarian, non_vegetarian, vegan)", () => {
    const { dietTypes } = classifyRecipeDietTypes("VEGAN , VEGETARIAN")
    expect(dietTypes).toEqual(expect.arrayContaining(["vegetarian", "eggetarian", "non_vegetarian", "vegan"]))
    expect(dietTypes).not.toContain("jain")
  })

  it("JAIN, VEGAN adds both jain and vegan on top of the vegetarian-safe widening", () => {
    const { dietTypes } = classifyRecipeDietTypes("JAIN, VEGAN")
    expect(dietTypes).toEqual(expect.arrayContaining(["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"]))
  })

  it("JAIN, VEGETARIAN adds jain but not vegan", () => {
    const { dietTypes } = classifyRecipeDietTypes("JAIN, VEGETARIAN")
    expect(dietTypes).toEqual(expect.arrayContaining(["vegetarian", "eggetarian", "non_vegetarian", "jain"]))
    expect(dietTypes).not.toContain("vegan")
  })

  it("plain VEGETARIAN alone widens to eggetarian and non_vegetarian too, but not vegan/jain", () => {
    const { dietTypes } = classifyRecipeDietTypes("VEGETARIAN")
    expect(dietTypes).toEqual(["vegetarian", "eggetarian", "non_vegetarian"])
  })

  it("EGG / OVOVEGETARIAN tokens classify as eggetarian + non_vegetarian only", () => {
    expect(classifyRecipeDietTypes("EGG").dietTypes).toEqual(["eggetarian", "non_vegetarian"])
    expect(classifyRecipeDietTypes("OVOVEGETARIAN , EGG").dietTypes).toEqual(["eggetarian", "non_vegetarian"])
  })

  it("real typo variants of OVOVEGETARIAN normalize correctly", () => {
    expect(classifyRecipeDietTypes("EGG,OVOVETARAIN").dietTypes).toEqual(["eggetarian", "non_vegetarian"])
    expect(classifyRecipeDietTypes("EGG , OVO VEGETRAIAN").dietTypes).toEqual(["eggetarian", "non_vegetarian"])
    expect(classifyRecipeDietTypes("EGG , OVOVETARIAN").dietTypes).toEqual(["eggetarian", "non_vegetarian"])
  })

  it("real meat/fish/seafood tokens classify as non_vegetarian only", () => {
    expect(classifyRecipeDietTypes("CHICKEN, NON VEGETARIAN").dietTypes).toEqual(["non_vegetarian"])
    expect(classifyRecipeDietTypes("CHICKEN, NONVEGETARIAN").dietTypes).toEqual(["non_vegetarian"])
    expect(classifyRecipeDietTypes("FISH , NONVEGTARIAN").dietTypes).toEqual(["non_vegetarian"])
    expect(classifyRecipeDietTypes("SEAFOOD").dietTypes).toEqual(["non_vegetarian"])
    expect(classifyRecipeDietTypes("CHICKEN").dietTypes).toEqual(["non_vegetarian"])
  })

  it("flags containsFish/containsSeafood/containsEgg for allergen cross-referencing", () => {
    expect(classifyRecipeDietTypes("FISH, NON VEGETARIAN").containsFish).toBe(true)
    expect(classifyRecipeDietTypes("SEAFOOD").containsSeafood).toBe(true)
    expect(classifyRecipeDietTypes("EGG").containsEgg).toBe(true)
    expect(classifyRecipeDietTypes("VEGETARIAN").containsEgg).toBe(false)
  })

  it("every one of the 25 real distinct Diet Pref values in the dataset classifies with zero unclassified tokens", () => {
    const realValues = [
      "VEGAN , VEGETARIAN",
      "JAIN, VEGAN",
      "JAIN, VEGETARIAN",
      "VEGETARIAN",
      "OVOVEGETARIAN , EGG",
      "VEGAN",
      "CHICKEN, NON VEGETARIAN",
      "EGG",
      "JAIN, VEGAN, VEGETARIAN",
      "EGG, OVOVEGETARIAN",
      "FISH, NON VEGETARIAN",
      "CHICKEN, NONVEGETARIAN",
      "VEGAN , VEGETARIAN, JAIN",
      "VEGAN, VEGETARIAN",
      "CHICKEN",
      "FISH",
      "JAIN, VEGAN,VEGETARIAN",
      "JAIN, VEGETARIAN ,VEGAN",
      "EGG,OVOVETARAIN",
      "JAIN, VEGETARIAN , VEGAN",
      "VEGAN, VEGETARIAN, JAIN",
      "EGG , OVO VEGETRAIAN",
      "SEAFOOD",
      "FISH , NONVEGTARIAN",
      "EGG , OVOVETARIAN",
    ]
    for (const raw of realValues) {
      expect(classifyRecipeDietTypes(raw).unclassifiedTokens, raw).toEqual([])
    }
  })

  it("returns an empty, non-fabricated result for a genuinely novel value", () => {
    const { dietTypes, unclassifiedTokens } = classifyRecipeDietTypes("PALEO")
    expect(dietTypes).toEqual([])
    expect(unclassifiedTokens).toEqual(["PALEO"])
  })
})
