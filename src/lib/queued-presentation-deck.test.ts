import { beforeEach, describe, expect, it } from "vitest"
import { createEgwDeckItems } from "@/lib/egw-deck"
import { restorePresentationDeckForQueueItem } from "@/lib/queued-presentation-deck"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import type { EgwParagraph, QueueItem } from "@/types"

const LONG_TEXT = Array.from(
  { length: 8 },
  (_, i) => `Sentence number ${i + 1} of a long Ellen White paragraph that keeps going.`,
).join(" ")

const paragraph: EgwParagraph = {
  id: 42,
  book_number: 1,
  book_title: "Steps to Christ",
  chapter: 1,
  chapter_title: "God's Love for Man",
  paragraph: 3,
  page: 9,
  page_paragraph: 1,
  text: LONG_TEXT,
}

function egwQueueItem(slideIndex = 0): QueueItem {
  const deck = createEgwDeckItems(paragraph)
  return {
    id: "queue-egw-1",
    presentation: deck[slideIndex]!,
    confidence: 1,
    source: "manual",
    added_at: Date.now(),
  }
}

describe("restorePresentationDeckForQueueItem — EGW", () => {
  beforeEach(() => {
    useEgwSlideStore.getState().setDeck([], 0)
  })

  it("rebuilds the multi-slide EGW deck from the queued paragraph", () => {
    const item = egwQueueItem(0)
    expect(restorePresentationDeckForQueueItem(item)).toBe(true)

    const { deck, activeIndex } = useEgwSlideStore.getState()
    expect(deck.length).toBeGreaterThan(1) // the regression: this was 0
    expect(activeIndex).toBe(0)
    expect(deck.map((s) => s.paragraph.id)).toEqual(deck.map(() => 42))
  })

  it("positions the deck at the queued slide", () => {
    const item = egwQueueItem(1)
    restorePresentationDeckForQueueItem(item)
    expect(useEgwSlideStore.getState().activeIndex).toBe(1)
  })
})
