import { describe, expect, it } from "vitest"
import {
  createEgwPresentationItem,
  createEgwQueueItem,
  egwReference,
} from "@/lib/presentation-workflow"
import type { EgwParagraph } from "@/types"

const para: EgwParagraph = {
  id: 7,
  book_number: 1,
  book_title: "Patriarchs and Prophets",
  chapter: 2,
  chapter_title: "The Creation",
  paragraph: 5,
  text: "God is love.",
}

describe("EGW presentation helpers", () => {
  it("formats the reference as title chapter:paragraph", () => {
    expect(egwReference(para)).toBe("Patriarchs and Prophets 2:5")
  })

  it("builds an egw presentation item with readable segments", () => {
    const item = createEgwPresentationItem(para)
    expect(item.kind).toBe("egw")
    expect(item.reference).toBe("Patriarchs and Prophets 2:5")
    expect(item.segments).toEqual([{ text: "God is love." }])
    expect(item.paragraph).toBe(para)
  })

  it("splits long EGW paragraphs at sentence boundaries", () => {
    const item = createEgwPresentationItem({
      ...para,
      text: [
        "This is a long opening sentence that sets up the first thought and continues with enough words to make the paragraph heavy.",
        "This second sentence carries the same paragraph forward with another complete thought that should not be glued to everything else.",
        "This final sentence gives the renderer a separate block to balance on the slide.",
      ].join(" "),
    })

    expect(item.segments.length).toBeGreaterThan(1)
    expect(item.segments.every((segment) => segment.text.length > 0)).toBe(true)
    expect(item.segments.every((segment) => segment.text.length <= 150)).toBe(true)
  })

  it("splits a single oversized EGW sentence into readable segments", () => {
    const item = createEgwPresentationItem({
      ...para,
      text: "This unusually long sentence keeps moving through several related clauses, with a first complete thought, with a second clarifying thought, and with a final practical application that would otherwise be too dense for one projected slide.",
    })

    expect(item.segments.length).toBeGreaterThan(1)
    expect(item.segments.every((segment) => segment.text.length <= 150)).toBe(true)
  })

  it("builds a manual queue item wrapping the presentation", () => {
    const q = createEgwQueueItem(para)
    expect(q.source).toBe("manual")
    expect(q.confidence).toBe(1)
    expect(q.presentation.kind).toBe("egw")
    expect(typeof q.id).toBe("string")
  })
})
