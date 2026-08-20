import { describe, expect, it } from "vitest"

import { parseCsvRows } from "./csv-parser"

describe("parseCsvRows", () => {
  it("splits a simple unquoted row", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("handles a quoted field containing a comma", () => {
    expect(parseCsvRows('a,"b,c",d')).toEqual([["a", "b,c", "d"]])
  })

  it("handles a quoted field containing an embedded newline", () => {
    expect(parseCsvRows('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]])
  })

  it("handles an escaped double-quote inside a quoted field", () => {
    expect(parseCsvRows('a,"she said ""hi""",c')).toEqual([["a", 'she said "hi"', "c"]])
  })

  it("strips carriage returns", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("captures a final row with no trailing newline", () => {
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})
