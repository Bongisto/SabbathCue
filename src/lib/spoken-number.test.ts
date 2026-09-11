import { describe, expect, it } from "vitest"
import {
  extractSpokenNumberPhrase,
  isSpokenNumberToken,
  parsePositiveSpokenNumber,
} from "./spoken-number"

describe("parsePositiveSpokenNumber", () => {
  it.each([
    ["1", 1],
    ["twelve", 12],
    ["twenty one", 21],
    ["twenty-one", 21],
    ["two hundred fifty one", 251],
    ["one hundred and one", 101],
    ["twaalf", 12],
    ["drie en twintig", 23],
    ["een honderd", 100],
    // Afrikaans inverted compounds spoken/written as one word.
    ["eenentwintig", 21],
    ["tweeëntwintig", 22],
    ["drieëntwintig", 23],
    ["drieentwintig", 23],
    ["negeënveertig", 49],
    ["agtentagtig", 88],
  ])("parses %s", (value, expected) => {
    expect(parsePositiveSpokenNumber(value)).toBe(expected)
  })

  it.each([
    "",
    "0",
    "zero",
    "-1",
    "1.5",
    "one two",
    "one hundred one two",
    // Ordinary words must never decompose into numbers, and exact number
    // words ("sewentig" = 70) must win over compound decomposition.
    "sesentien",
    "constructor",
  ])("rejects %s", (value) => {
    expect(parsePositiveSpokenNumber(value)).toBeNull()
  })

  it.each([
    "sewentien",
    "sewentig",
    "hundred",
    "46",
    "drieentwintig",
    "tweeëntwintig",
  ])("recognises %s as a number token", (token) => {
    expect(isSpokenNumberToken(token)).toBe(true)
  })

  it.each(["let", "us", "pray", "constructor", "2-3", "2abc"])(
    "does not recognise %s as a number token",
    (token) => {
      expect(isSpokenNumberToken(token)).toBe(false)
    }
  )
})

describe("extractSpokenNumberPhrase", () => {
  it("keeps the leading number run", () => {
    expect(extractSpokenNumberPhrase("is number 302")).toBe("302")
    expect(extractSpokenNumberPhrase("46 together")).toBe("46")
    expect(extractSpokenNumberPhrase("one hundred")).toBe("one hundred")
    expect(extractSpokenNumberPhrase("ses en veertig")).toBe("ses en veertig")
    expect(extractSpokenNumberPhrase("drieentwintig")).toBe("drieentwintig")
  })

  it("stops at the first non-number word once a number started", () => {
    expect(extractSpokenNumberPhrase("46 and then the sermon")).toBe("46")
    expect(extractSpokenNumberPhrase("46 or 53")).toBe("46")
  })

  it("drops connector words at the phrase edges only", () => {
    expect(extractSpokenNumberPhrase("46 and")).toBe("46")
    expect(extractSpokenNumberPhrase("een en")).toBe("een")
    expect(extractSpokenNumberPhrase("and 46")).toBe("46")
  })

  it("returns an empty string when no number token is present", () => {
    expect(extractSpokenNumberPhrase("number")).toBe("")
    expect(extractSpokenNumberPhrase("")).toBe("")
  })
})
