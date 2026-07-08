import { describe, expect, it } from "vitest"
import {
  canNavigateDeck,
  clampDeckIndex,
  egwDeckSlides,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
} from "./presentation-deck-navigation"
import type {
  EgwPresentationItemData,
  HymnPresentationItemData,
  SlideDeckPresentationItemData,
} from "@/types"

function hymnSlide(index: number): HymnPresentationItemData {
  return {
    kind: "hymn",
    hymnId: "h1",
    hymnNumber: 1,
    hymnTitle: "Test",
    screenId: `screen-${index}`,
    slideIndex: index,
    slideCount: 3,
    reference: `Slide ${index + 1}`,
    segments: [{ text: "line" }],
  }
}

function egwSlide(index: number, count = 2): EgwPresentationItemData {
  return {
    kind: "egw",
    paragraph: {
      id: 1,
      book_number: 1,
      book_title: "Test Book",
      chapter: 1,
      chapter_title: "Chapter",
      paragraph: 1,
      page: 29,
      page_paragraph: 1,
      text: "Sample text.",
    },
    reference: `Test Book p.29 par.1 (${index + 1}/${count})`,
    slideId: `egw-1-${index}`,
    slideIndex: index,
    slideCount: count,
    segments: [{ text: "Sample text." }],
  }
}

function sermonSlide(index: number): SlideDeckPresentationItemData {
  return {
    kind: "slideDeck",
    deckId: "deck-1",
    deckTitle: "Sermon",
    slideId: `slide-${index}`,
    slideIndex: index,
    slideCount: 2,
    slidePath: `/slides/${index}.png`,
    reference: `Sermon ${index + 1}`,
    segments: [{ text: "caption" }],
  }
}

describe("presentation deck navigation", () => {
  it("maps hymn, sermon, and EGW decks to a shared slide shape", () => {
    expect(hymnDeckSlides([hymnSlide(0), hymnSlide(1)])).toEqual([
      expect.objectContaining({ slideId: "screen-0", slideIndex: 0 }),
      expect.objectContaining({ slideId: "screen-1", slideIndex: 1 }),
    ])
    expect(sermonDeckSlides([sermonSlide(0)])).toEqual([
      expect.objectContaining({ slideId: "slide-0", slideIndex: 0 }),
    ])
    expect(egwDeckSlides([egwSlide(0), egwSlide(1)])).toEqual([
      expect.objectContaining({ slideId: "egw-1-0", slideIndex: 0 }),
      expect.objectContaining({ slideId: "egw-1-1", slideIndex: 1 }),
    ])
  })

  it("detects deck-backed preview items", () => {
    expect(
      presentationDeckKind({
        kind: "slideDeck",
        reference: "Sermon 1",
        segments: [],
        hymnSlide: { screenId: "slide-0", slideIndex: 0, slideCount: 2 },
      }),
    ).toBe("slideDeck")
    expect(presentationDeckSlideId({
      kind: "hymn",
      reference: "Hymn",
      segments: [],
      hymnSlide: { screenId: "screen-1", slideIndex: 1, slideCount: 3 },
    })).toBe("screen-1")
    expect(
      presentationDeckKind({
        kind: "egw",
        reference: "Test p.29 par.1 (1/2)",
        segments: [],
        hymnSlide: { screenId: "egw-1-0", slideIndex: 0, slideCount: 2 },
      }),
    ).toBe("egw")
  })

  it("clamps next and previous indices", () => {
    const deck = hymnDeckSlides([hymnSlide(0), hymnSlide(1), hymnSlide(2)])
    const index = findDeckIndex(deck, "screen-1", 0)
    expect(clampDeckIndex(deck.length, index, 1)).toBe(2)
    expect(canNavigateDeck(deck.length, index, -1)).toBe(true)
    expect(canNavigateDeck(deck.length, 0, -1)).toBe(false)
  })
})
