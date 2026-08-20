import { describe, expect, it } from "vitest"

import { normalizeRecipeSeason } from "./recipe-season-mapping"

describe("normalizeRecipeSeason", () => {
  it("maps the 3 real distinct Season values", () => {
    expect(normalizeRecipeSeason("Winter")).toEqual({ season: "winter", unrecognized: false })
    expect(normalizeRecipeSeason("Summer")).toEqual({ season: "summer", unrecognized: false })
    expect(normalizeRecipeSeason("All Season")).toEqual({ season: "all_year", unrecognized: false })
  })

  it("falls back to all_year and flags a genuinely unrecognized value", () => {
    expect(normalizeRecipeSeason("Monsoon")).toEqual({ season: "all_year", unrecognized: true })
  })
})
