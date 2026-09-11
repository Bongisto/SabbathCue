import { describe, expect, it } from "vitest"
import {
  extractHymnNumberPhrase,
  looksLikeHymnCommand,
  matchHymnCue,
} from "./hymn-cue"

describe("looksLikeHymnCommand (transcript_final gate)", () => {
  it("passes the phrasings the 2026-09-11 live session produced", () => {
    expect(looksLikeHymnCommand("Hymn No. 46.")).toBe(true)
    expect(looksLikeHymnCommand("Hymn No. 1")).toBe(true)
    expect(looksLikeHymnCommand("Hymn No. 100.")).toBe(true)
    expect(looksLikeHymnCommand("Song No. 53.")).toBe(true)
  })

  it("passes punctuation-glued cues the old gate silently dropped", () => {
    expect(looksLikeHymnCommand("hymn #46")).toBe(true)
    expect(looksLikeHymnCommand("hymn: 46")).toBe(true)
  })

  it("passes cue words followed by filler before the number", () => {
    expect(looksLikeHymnCommand("our next hymn is number 302")).toBe(true)
    expect(looksLikeHymnCommand("let us sing hymn 46 together")).toBe(true)
  })

  it("keeps existing cue variants passing", () => {
    expect(looksLikeHymnCommand("hymn 12")).toBe(true)
    expect(looksLikeHymnCommand("SDA hymn 100")).toBe(true)
    expect(looksLikeHymnCommand("Seventh-day Adventist hymnal 100")).toBe(true)
    expect(looksLikeHymnCommand("Sewendedag Adventiste lied 100")).toBe(true)
  })

  it("rejects ordinary speech and bare numbers", () => {
    expect(looksLikeHymnCommand("let us pray")).toBe(false)
    expect(looksLikeHymnCommand("we are talking about obedience and grace")).toBe(false)
    expect(looksLikeHymnCommand("John 3 16")).toBe(false)
    expect(looksLikeHymnCommand("47.")).toBe(false)
    expect(looksLikeHymnCommand("")).toBe(false)
  })

  it("rejects cue words with no number to parse", () => {
    expect(looksLikeHymnCommand("hymn number")).toBe(false)
    expect(looksLikeHymnCommand("song books")).toBe(false)
  })
})

describe("matchHymnCue", () => {
  it("captures the tail after the cue word", () => {
    expect(matchHymnCue("Hymn No. 46.")).toBe("46")
    expect(matchHymnCue("SDA hymn 100")).toBe("100")
    expect(matchHymnCue("our next hymn is number 302")).toBe("is number 302")
    expect(matchHymnCue("let us pray")).toBeNull()
  })
})

describe("extractHymnNumberPhrase", () => {
  it("keeps the leading number run", () => {
    expect(extractHymnNumberPhrase("is number 302")).toBe("302")
    expect(extractHymnNumberPhrase("46 together")).toBe("46")
    expect(extractHymnNumberPhrase("one hundred")).toBe("one hundred")
    expect(extractHymnNumberPhrase("ses en veertig")).toBe("ses en veertig")
  })

  it("stops at the first non-number word once a number started", () => {
    expect(extractHymnNumberPhrase("46 and then the sermon")).toBe("46")
    expect(extractHymnNumberPhrase("46 or 53")).toBe("46")
  })

  it("drops connector words at the phrase edges only", () => {
    expect(extractHymnNumberPhrase("46 and")).toBe("46")
    expect(extractHymnNumberPhrase("een en")).toBe("een")
    expect(extractHymnNumberPhrase("and 46")).toBe("46")
  })

  it("returns an empty string when no number token is present", () => {
    expect(extractHymnNumberPhrase("number")).toBe("")
    expect(extractHymnNumberPhrase("")).toBe("")
  })
})
