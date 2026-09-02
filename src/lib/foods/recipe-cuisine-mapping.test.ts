import { describe, expect, it } from "vitest"

import { eligibleCuisinesFor, normalizeCuisine, templateRegionForCuisine } from "./recipe-cuisine-mapping"

describe("normalizeCuisine", () => {
  it("keeps the 8 known Indian regional cuisines as-is", () => {
    for (const c of [
      "North Indian",
      "South Indian",
      "Maharashtrian",
      "Bengali",
      "Gujarati",
      "Punjabi",
      "Rajasthani",
      "Hyderabadi",
    ] as const) {
      expect(normalizeCuisine(c)).toBe(c)
    }
  })

  it("fixes the real Gujrati typo to Gujarati", () => {
    expect(normalizeCuisine("Gujrati")).toBe("Gujarati")
  })

  it("relabels every low-volume non-Indian cuisine to General, per the confirmed decision", () => {
    for (const c of ["Italian", "Chinese", "Mediterranean", "Mexican", "Exotic", "Parsi", "Japanese", "Goan"]) {
      expect(normalizeCuisine(c)).toBe("General")
    }
  })

  it("leaves General as General", () => {
    expect(normalizeCuisine("General")).toBe("General")
  })

  it("relabels a genuinely unrecognized value to General too", () => {
    expect(normalizeCuisine("Some Future Cuisine")).toBe("General")
  })
})

describe("eligibleCuisinesFor", () => {
  it("always includes General alongside the requested cuisine", () => {
    expect(eligibleCuisinesFor("North Indian").sort()).toEqual(["General", "North Indian"].sort())
  })

  it("deduplicates when the requested cuisine is already General", () => {
    expect(eligibleCuisinesFor("General")).toEqual(["General"])
  })

  it("folds North Indian into a Punjabi request — Punjabi has no natively-tagged rows, and its canon (rajma, chole, kadhi) carries the North Indian tag", () => {
    expect(eligibleCuisinesFor("Punjabi").sort()).toEqual(["General", "North Indian", "Punjabi"].sort())
  })

  it("folds North Indian into a Rajasthani request too — same situation, same regional parent", () => {
    expect(eligibleCuisinesFor("Rajasthani").sort()).toEqual(["General", "North Indian", "Rajasthani"].sort())
  })

  it("does NOT give Hyderabadi a North Indian parent — it is a Deccan cuisine", () => {
    expect(eligibleCuisinesFor("Hyderabadi").sort()).toEqual(["General", "Hyderabadi"].sort())
  })

  it("leaves every other cuisine on the plain requested+General pair", () => {
    for (const c of ["South Indian", "Bengali", "Gujarati", "Maharashtrian"] as const) {
      expect(eligibleCuisinesFor(c).sort()).toEqual(["General", c].sort())
    }
  })
})

describe("templateRegionForCuisine", () => {
  it("maps each known regional cuisine to its meal_templates region", () => {
    expect(templateRegionForCuisine("North Indian")).toBe("north_indian")
    expect(templateRegionForCuisine("Bengali")).toBe("bengali")
  })

  it("defaults General to north_indian for slot scheduling only", () => {
    expect(templateRegionForCuisine("General")).toBe("north_indian")
  })

  it("maps the 3 later-added regional cuisines (Punjabi/Rajasthani/Hyderabadi) to their own seeded meal_templates region", () => {
    expect(templateRegionForCuisine("Punjabi")).toBe("punjabi")
    expect(templateRegionForCuisine("Rajasthani")).toBe("rajasthani")
    expect(templateRegionForCuisine("Hyderabadi")).toBe("hyderabadi")
  })
})
