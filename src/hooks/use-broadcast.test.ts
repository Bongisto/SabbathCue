import { describe, expect, it } from "vitest"
import type { Verse } from "@/types"
import { toVerseRenderData } from "./use-broadcast"

const sampleVerse: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 1,
  book_name: "Genesis",
  book_abbreviation: "Gen",
  chapter: 1,
  verse: 2,
  text: "The earth was without form and void.",
}

describe("toVerseRenderData", () => {
  it("formats a verse for preview and live rendering", () => {
    const result = toVerseRenderData(sampleVerse, "NKJV")

    expect(result).toEqual({
      reference: "Genesis 1:2 (NKJV)",
      segments: [{ verseNumber: 2, text: "The earth was without form and void." }],
    })
  })

  it("splits long Bible verses into smaller readable chunks", () => {
    const result = toVerseRenderData(
      {
        ...sampleVerse,
        text: [
          "This very long verse begins with a complete thought that should remain readable for the congregation.",
          "It then continues with another substantial thought, adding enough words to make the verse too heavy for a single dense text block.",
          "Finally it closes with a practical phrase that should be kept visible without forcing the renderer to shrink everything dramatically.",
        ].join(" "),
      },
      "KJV",
    )

    expect(result.segments.length).toBeGreaterThan(1)
    expect(result.segments[0].verseNumber).toBe(2)
    expect(result.segments.slice(1).every((segment) => segment.verseNumber === undefined)).toBe(true)
    expect(result.segments.every((segment) => segment.text.length <= 150)).toBe(true)
  })
})
