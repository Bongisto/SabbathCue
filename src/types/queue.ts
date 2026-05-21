import type { PresentationItem } from "./presentation"
import {
  getPresentationReference,
  getScriptureVerse,
} from "./presentation"

export interface QueueItem {
  id: string
  presentation: PresentationItem
  confidence: number
  source: "manual" | "hymn" | "ai-direct" | "ai-semantic" | "ai-cloud"
  added_at: number
  /** True when queued from a chapter-only detection (verse defaults to 1, may be refined). */
  is_chapter_only?: boolean
}

export function getVerseFromItem(item: QueueItem) {
  return getScriptureVerse(item.presentation)
}

export function getReferenceFromItem(item: QueueItem) {
  return getPresentationReference(item.presentation)
}
