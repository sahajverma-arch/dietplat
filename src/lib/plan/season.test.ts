import { describe, expect, it } from "vitest"
import { seasonFor } from "./season"

describe("seasonFor", () => {
  it("August lands on monsoon", () => {
    expect(seasonFor("2026-08-10", "punjabi")).toBe("monsoon")
  })

  it("January and February land on winter", () => {
    expect(seasonFor("2026-01-15", "punjabi")).toBe("winter")
    expect(seasonFor("2026-02-01", "punjabi")).toBe("winter")
  })

  it("March through June land on summer", () => {
    expect(seasonFor("2026-03-01", "punjabi")).toBe("summer")
    expect(seasonFor("2026-06-30", "punjabi")).toBe("summer")
  })

  it("July through October land on monsoon", () => {
    expect(seasonFor("2026-07-01", "punjabi")).toBe("monsoon")
    expect(seasonFor("2026-10-31", "punjabi")).toBe("monsoon")
  })

  it("November and December land on winter", () => {
    expect(seasonFor("2026-11-01", "punjabi")).toBe("winter")
    expect(seasonFor("2026-12-25", "punjabi")).toBe("winter")
  })

  it("is deterministic — same input, same output, regardless of region (only one calendar exists today)", () => {
    expect(seasonFor("2026-08-10", "punjabi")).toBe(seasonFor("2026-08-10", "south_indian"))
  })

  it("reads the date as UTC, not local time, so it's stable regardless of server timezone", () => {
    // 2026-08-31T23:00 local-negative-offset timezones could otherwise spill into September.
    expect(seasonFor("2026-08-31", "punjabi")).toBe("monsoon")
  })
})
