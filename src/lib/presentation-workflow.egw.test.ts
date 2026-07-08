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
  page: 34,
  page_paragraph: 2,
  text: "God is love.",
}

describe("EGW presentation helpers", () => {
  it("formats the reference as title page paragraph", () => {
    expect(egwReference(para)).toBe("Patriarchs and Prophets p.34 par.2")
  })

  it("builds an egw presentation item with readable segments", () => {
    const item = createEgwPresentationItem(para)
    expect(item.kind).toBe("egw")
    expect(item.reference).toBe("Patriarchs and Prophets p.34 par.2")
    expect(item.segments).toEqual([{ text: "God is love." }])
    expect(item.slideIndex).toBe(0)
    expect(item.slideCount).toBe(1)
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

    expect(item.slideCount).toBeGreaterThan(1)
    expect(item.segments).toHaveLength(1)
    expect(item.segments[0]?.text.length).toBeGreaterThan(0)
    expect(item.segments[0]?.text.length).toBeLessThanOrEqual(150)
  })

  it("splits a single oversized EGW sentence into readable segments", () => {
    const item = createEgwPresentationItem({
      ...para,
      text: "This unusually long sentence keeps moving through several related clauses, with a first complete thought, with a second clarifying thought, and with a final practical application that would otherwise be too dense for one projected slide.",
    })

    expect(item.slideCount).toBeGreaterThan(1)
    expect(item.segments).toHaveLength(1)
    expect(item.segments[0]?.text.length).toBeLessThanOrEqual(150)
  })

  it("builds a manual queue item wrapping the presentation", () => {
    const q = createEgwQueueItem(para)
    expect(q.source).toBe("manual")
    expect(q.confidence).toBe(1)
    expect(q.presentation.kind).toBe("egw")
    expect(typeof q.id).toBe("string")
  })
})
