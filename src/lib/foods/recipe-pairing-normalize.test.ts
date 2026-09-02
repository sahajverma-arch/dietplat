import { describe, expect, it } from "vitest"

import { parsePairingList } from "./recipe-pairing-normalize"

describe("parsePairingList", () => {
  it("splits a comma-separated cell into trimmed tokens", () => {
    expect(parsePairingList("Pulao, Khichdi, Biryani")).toEqual(["Pulao", "Khichdi", "Biryani"])
  })

  it("returns an empty array for a blank cell", () => {
    expect(parsePairingList("")).toEqual([])
    expect(parsePairingList("   ")).toEqual([])
  })

  it("drops empty tokens from trailing/double commas", () => {
    expect(parsePairingList("Roti, , Sabzi,")).toEqual(["Roti", "Sabzi"])
  })

  it("dedupes case-insensitively, keeping the first casing seen", () => {
    expect(parsePairingList("Nuts, nuts, NUTS")).toEqual(["Nuts"])
  })
})
