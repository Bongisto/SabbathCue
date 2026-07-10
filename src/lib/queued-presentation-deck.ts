import { createEgwDeckItems } from "@/lib/egw-deck"
import { restoreHymnDeckForQueueItem } from "@/lib/queued-hymn-deck"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { QueueItem } from "@/types"

export function restorePresentationDeckForQueueItem(item: QueueItem): boolean {
  if (restoreHymnDeckForQueueItem(item)) return true

  const presentation = item.presentation

  if (presentation.kind === "egw") {
    const deck = createEgwDeckItems(presentation.paragraph)
    const activeIndex = deck.findIndex(
      (slide) => slide.slideId === presentation.slideId
    )
    useEgwSlideStore
      .getState()
      .setDeck(deck, activeIndex >= 0 ? activeIndex : presentation.slideIndex)
    return true
  }

  if (presentation.kind !== "slideDeck" || !item.slideDeck?.length) {
    return false
  }

  const activeIndex = item.slideDeck.findIndex(
    (slide) => slide.slideId === presentation.slideId
  )
  useSermonSlideStore.getState().setDeck(
    item.slideDeck,
    activeIndex >= 0 ? activeIndex : presentation.slideIndex,
    presentation.deckId
  )
  return true
}
