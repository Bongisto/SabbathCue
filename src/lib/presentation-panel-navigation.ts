import { bibleActions } from "@/hooks/use-bible"
import { egwActions } from "@/hooks/use-egw"
import {
  presentItem,
  presentVerse,
  previewEgwParagraph,
  presentEgwParagraph,
  selectPreviewVerse,
  selectPreviewItem,
} from "@/lib/presentation-workflow"
import { presentQueuedItem } from "@/lib/queue-presentation"
import { restoreQueuedHymnDeckForRenderItem } from "@/lib/queued-hymn-deck"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useEgwStore } from "@/stores/egw-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import {
  clampDeckIndex,
  egwDeckSlides,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
} from "@/lib/presentation-deck-navigation"
import type { EgwParagraph, PresentationRenderData, Verse } from "@/types"

export function isPresentationNavigationEditableTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  return Boolean(
    target.closest(
      '[contenteditable="true"], input, textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"]'
    )
  )
}

function presentOrPreview(
  next: Parameters<typeof presentItem>[0],
  isLive: boolean
): void {
  if (isLive) presentItem(next)
  else selectPreviewItem(next)
}

function scriptureFromTarget(
  targetItem: PresentationRenderData | null
): Verse | null {
  if (targetItem?.kind !== "scripture") return null
  return targetItem.scripture ?? useBibleStore.getState().selectedVerse
}

function findAdjacentVerse(
  current: Verse,
  verses: Verse[],
  delta: number
): Verse | null {
  const currentIndex = verses.findIndex(
    (verse) =>
      verse.book_number === current.book_number &&
      verse.chapter === current.chapter &&
      verse.verse === current.verse
  )
  if (currentIndex < 0) return null
  const next = verses[currentIndex + delta]
  if (!next) return null
  if (
    next.book_number !== current.book_number ||
    next.chapter !== current.chapter
  ) {
    return null
  }
  return next
}

async function advanceScripture(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): Promise<void> {
  const current = scriptureFromTarget(targetItem)
  if (!current) return

  const bible = useBibleStore.getState()
  let chapter = bible.currentChapter.filter(
    (verse) =>
      verse.book_number === current.book_number &&
      verse.chapter === current.chapter
  )

  if (chapter.length === 0) {
    chapter = await bibleActions.loadChapter(
      current.book_number,
      current.chapter,
      current.translation_id
    )
  }

  const next =
    findAdjacentVerse(current, chapter, delta) ??
    (await bibleActions.fetchVerse(
      current.book_number,
      current.chapter,
      current.verse + delta,
      current.translation_id
    ))

  if (!next) return
  if (isLive) presentVerse(next, { navigate: true })
  else selectPreviewVerse(next, { navigate: true })
}

function queueScriptureAdvance(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  if (!scriptureFromTarget(targetItem)) return false
  void advanceScripture(delta, targetItem, isLive).catch((error) => {
    console.warn("[keyboard] scripture navigation failed", error)
  })
  return true
}

function egwParagraphFromTarget(
  targetItem: PresentationRenderData | null
): EgwParagraph | null {
  if (targetItem?.kind !== "egw") return null
  if (targetItem.egwParagraph) return targetItem.egwParagraph

  const egwSlides = useEgwSlideStore.getState()
  return egwSlides.deck[egwSlides.activeIndex]?.paragraph ?? null
}

function findAdjacentEgwParagraph(
  current: EgwParagraph,
  paragraphs: EgwParagraph[],
  delta: number
): EgwParagraph | null {
  const currentIndex = paragraphs.findIndex(
    (paragraph) =>
      paragraph.id === current.id ||
      (paragraph.book_number === current.book_number &&
        paragraph.chapter === current.chapter &&
        paragraph.paragraph === current.paragraph)
  )
  if (currentIndex < 0) return null
  const next = paragraphs[currentIndex + delta]
  if (!next) return null
  if (
    next.book_number !== current.book_number ||
    next.chapter !== current.chapter
  ) {
    return null
  }
  return next
}

async function advanceEgwParagraph(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): Promise<void> {
  const current = egwParagraphFromTarget(targetItem)
  if (!current) return

  let paragraphs = useEgwStore
    .getState()
    .currentParagraphs.filter(
      (paragraph) =>
        paragraph.book_number === current.book_number &&
        paragraph.chapter === current.chapter
    )

  if (paragraphs.length === 0) {
    paragraphs = await egwActions.loadChapter(
      current.book_number,
      current.chapter
    )
  }

  const next = findAdjacentEgwParagraph(current, paragraphs, delta)
  if (!next) return
  if (isLive) presentEgwParagraph(next)
  else previewEgwParagraph(next)
}

function queueEgwParagraphAdvance(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  if (!egwParagraphFromTarget(targetItem)) return false
  void advanceEgwParagraph(delta, targetItem, isLive).catch((error) => {
    console.warn("[keyboard] EGW navigation failed", error)
  })
  return true
}

function advanceLiveHymnGroup(delta: number): boolean {
  const queue = useQueueStore.getState()
  const activeQueueItem =
    queue.activeIndex === null ? null : (queue.items[queue.activeIndex] ?? null)

  if (
    activeQueueItem?.presentation.kind === "hymn" &&
    activeQueueItem.hymnGroup
  ) {
    const activeGroup = activeQueueItem.hymnGroup
    const targetItemIndex = activeGroup.itemIndex + delta
    const targetQueueIndex = queue.items.findIndex((item) => {
      const group = item.hymnGroup
      return (
        item.presentation.kind === "hymn" &&
        group?.groupId === activeGroup.groupId &&
        group.itemIndex === targetItemIndex
      )
    })
    const target = queue.items[targetQueueIndex]
    if (target) {
      queue.setActive(targetQueueIndex)
      presentQueuedItem(target)
      return true
    }
  }
  return false
}

function advanceHymnDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  restoreQueuedHymnDeckForRenderItem(targetItem)
  const hymnSlides = useHymnSlideStore.getState()
  if (hymnSlides.deck.length === 0) return false
  const deck = hymnDeckSlides(hymnSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    hymnSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = hymnSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return true
  hymnSlides.setDeck(hymnSlides.deck, nextIndex)
  presentOrPreview(next, isLive)
  return true
}

function advanceEgwDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const egwSlides = useEgwSlideStore.getState()
  if (egwSlides.deck.length === 0) return false
  const deck = egwDeckSlides(egwSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    egwSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = egwSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return false
  egwSlides.setDeck(egwSlides.deck, nextIndex)
  presentOrPreview(next, isLive)
  return true
}

function advanceSermonDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const sermonSlides = useSermonSlideStore.getState()
  if (sermonSlides.deck.length === 0) return false
  const deck = sermonDeckSlides(sermonSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    sermonSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = sermonSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return true
  sermonSlides.setDeck(sermonSlides.deck, nextIndex, sermonSlides.activeItemId)
  presentOrPreview(next, isLive)
  return true
}

export function advancePresentationTarget(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const deckKind = presentationDeckKind(targetItem)
  if (!deckKind) {
    return queueScriptureAdvance(delta, targetItem, isLive)
  }

  if (isLive && deckKind === "hymn" && advanceLiveHymnGroup(delta)) {
    return true
  }
  if (deckKind === "hymn") return advanceHymnDeck(delta, targetItem, isLive)
  if (deckKind === "egw") {
    return (
      advanceEgwDeck(delta, targetItem, isLive) ||
      queueEgwParagraphAdvance(delta, targetItem, isLive)
    )
  }
  return advanceSermonDeck(delta, targetItem, isLive)
}

export function advanceCurrentPresentationTarget(delta: number): boolean {
  const broadcast = useBroadcastStore.getState()
  const targetItem = broadcast.isLive
    ? broadcast.liveItem
    : broadcast.previewItem
  return advancePresentationTarget(delta, targetItem, broadcast.isLive)
}
