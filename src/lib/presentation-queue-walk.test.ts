// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/queue-presentation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue-presentation")>()
  return {
    ...actual,
    presentQueuedItem: vi.fn(),
    presentQueuedItemAtEnd: vi.fn(),
  }
})

import { advancePresentationTarget } from "@/lib/presentation-panel-navigation"
import {
  presentQueuedItem,
  presentQueuedItemAtEnd,
} from "@/lib/queue-presentation"
import { createEgwDeckItems } from "@/lib/egw-deck"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import { getPresentationRenderData } from "@/types"
import type { EgwParagraph, QueueItem } from "@/types"

// Two long paragraphs, each of which chunks into a multi-slide EGW deck
// (createEgwDeckItems splits on ~150 chars — 8 sentences yields several slides).
const LONG_A = Array.from(
  { length: 8 },
  (_, i) =>
    `Alpha sentence ${i + 1} of a long Ellen White paragraph that keeps going onward.`,
).join(" ")
const LONG_B = Array.from(
  { length: 8 },
  (_, i) =>
    `Beta sentence ${i + 1} of a different long Ellen White paragraph moving forward.`,
).join(" ")

const paragraphA: EgwParagraph = {
  id: 101,
  book_number: 1,
  book_title: "Steps to Christ",
  chapter: 1,
  chapter_title: "God's Love for Man",
  paragraph: 1,
  page: 9,
  page_paragraph: 1,
  text: LONG_A,
}

const paragraphB: EgwParagraph = {
  id: 202,
  book_number: 1,
  book_title: "Steps to Christ",
  chapter: 1,
  chapter_title: "God's Love for Man",
  paragraph: 2,
  page: 9,
  page_paragraph: 2,
  text: LONG_B,
}

function egwQueueItem(id: string, p: EgwParagraph): QueueItem {
  const deck = createEgwDeckItems(p)
  return {
    id,
    presentation: deck[0]!,
    confidence: 1,
    source: "manual",
    added_at: Date.now(),
  }
}

const egwItemA = egwQueueItem("egw-a", paragraphA)
const egwItemB = egwQueueItem("egw-b", paragraphB)

function seedQueue(items: QueueItem[]): void {
  useQueueStore.getState().addItems(items)
  useQueueStore.getState().setActive(0)
}

describe("live arrow navigation across queue items", () => {
  beforeEach(() => {
    localStorage.clear()
    useQueueStore.getState().clearQueue()
    useEgwSlideStore.getState().setDeck([], 0)
    vi.mocked(presentQueuedItem).mockClear()
    vi.mocked(presentQueuedItemAtEnd).mockClear()
  })

  it("advances to the next queue item past the last EGW slide", async () => {
    const deckA = createEgwDeckItems(paragraphA)
    expect(deckA.length).toBeGreaterThan(1)
    seedQueue([egwItemA, egwItemB])
    useEgwSlideStore.getState().setDeck(deckA, deckA.length - 1)
    const live = getPresentationRenderData(deckA[deckA.length - 1]!)

    const handled = advancePresentationTarget(1, live, true)
    await vi.waitFor(() => expect(presentQueuedItem).toHaveBeenCalled())
    expect(handled).toBe(true)
    expect(useQueueStore.getState().activeIndex).toBe(1)
    expect(vi.mocked(presentQueuedItem).mock.calls[0][0].id).toBe(egwItemB.id)
  })

  it("goes to the previous item's LAST slide from the first slide", async () => {
    const deckB = createEgwDeckItems(paragraphB)
    seedQueue([egwItemA, egwItemB])
    useQueueStore.getState().setActive(1)
    useEgwSlideStore.getState().setDeck(deckB, 0)
    const live = getPresentationRenderData(deckB[0]!)

    advancePresentationTarget(-1, live, true)
    await vi.waitFor(() =>
      expect(presentQueuedItemAtEnd).toHaveBeenCalled(),
    )
    expect(useQueueStore.getState().activeIndex).toBe(0)
    expect(vi.mocked(presentQueuedItemAtEnd).mock.calls[0][0].id).toBe(
      egwItemA.id,
    )
  })

  it("stops at the end of the queue without wrapping", async () => {
    const deckB = createEgwDeckItems(paragraphB)
    seedQueue([egwItemA, egwItemB])
    useQueueStore.getState().setActive(1)
    useEgwSlideStore.getState().setDeck(deckB, deckB.length - 1)
    const live = getPresentationRenderData(deckB[deckB.length - 1]!)

    advancePresentationTarget(1, live, true)
    await Promise.resolve()
    expect(presentQueuedItem).not.toHaveBeenCalled()
    expect(presentQueuedItemAtEnd).not.toHaveBeenCalled()
    expect(useQueueStore.getState().activeIndex).toBe(1)
  })

  it("does not walk the queue when the live item did not come from the queue", async () => {
    const deckA = createEgwDeckItems(paragraphA)
    seedQueue([egwItemB]) // active item is a DIFFERENT paragraph than the live deck
    useQueueStore.getState().setActive(0)
    useEgwSlideStore.getState().setDeck(deckA, deckA.length - 1)
    const live = getPresentationRenderData(deckA[deckA.length - 1]!)

    advancePresentationTarget(1, live, true)
    await Promise.resolve()
    expect(presentQueuedItem).not.toHaveBeenCalled()
    expect(presentQueuedItemAtEnd).not.toHaveBeenCalled()
  })
})
