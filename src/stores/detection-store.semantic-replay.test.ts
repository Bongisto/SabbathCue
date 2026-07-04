import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDetectionStore } from "./detection-store"
import { useSettingsStore } from "./settings-store"
import type { DetectionResult } from "@/types"

function semanticHit(
  verseRef: string,
  confidence: number,
  bookName: string,
  bookNumber: number,
  chapter: number,
  verse: number
): DetectionResult {
  return {
    verse_ref: verseRef,
    verse_text: `${verseRef} semantic replay text`,
    book_name: bookName,
    book_number: bookNumber,
    chapter,
    verse,
    confidence,
    source: "semantic",
    auto_queued: false,
    transcript_snippet: `semantic replay transcript for ${verseRef}`,
    is_chapter_only: false,
  }
}

const SEMANTIC_REPLAY_HITS: DetectionResult[] = [
  semanticHit("John 3:16", 0.96, "John", 43, 3, 16),
  semanticHit("Romans 8:28", 0.91, "Romans", 45, 8, 28),
  semanticHit("Psalm 23:1", 0.86, "Psalm", 19, 23, 1),
  semanticHit("Isaiah 40:31", 0.8, "Isaiah", 23, 40, 31),
  semanticHit("Hebrews 11:1", 0.74, "Hebrews", 58, 11, 1),
  semanticHit("Matthew 6:33", 0.739, "Matthew", 40, 6, 33),
  semanticHit("Genesis 1:1", 0.7, "Genesis", 1, 1, 1),
  semanticHit("Revelation 14:12", 0.64, "Revelation", 66, 14, 12),
]

describe("semantic replay into Recent detections", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-07-04T10:00:00Z").getTime()
    )
    useDetectionStore.setState({ detections: [] })
    useSettingsStore.setState({
      semanticDetectionEnabled: true,
      semanticConfidenceThreshold: 0.74,
    })
  })

  afterEach(() => {
    useDetectionStore.getState().clearDetections()
    vi.restoreAllMocks()
  })

  it("shows semantic hits in Recent detections when they meet the app slider", () => {
    useDetectionStore.getState().addDetections(SEMANTIC_REPLAY_HITS)

    const detections = useDetectionStore.getState().detections
    expect(detections).toHaveLength(5)
    expect(detections.every((detection) => detection.source === "semantic")).toBe(
      true
    )
    expect(detections.map((detection) => detection.verse_ref)).toEqual([
      "John 3:16",
      "Romans 8:28",
      "Psalm 23:1",
      "Isaiah 40:31",
      "Hebrews 11:1",
    ])
  })

  it("follows a stricter confidence slider for semantic replay hits", () => {
    useSettingsStore.setState({ semanticConfidenceThreshold: 0.9 })

    useDetectionStore.getState().addDetections(SEMANTIC_REPLAY_HITS)

    expect(
      useDetectionStore.getState().detections.map((detection) => ({
        confidence: detection.confidence,
        ref: detection.verse_ref,
      }))
    ).toEqual([
      { confidence: 0.96, ref: "John 3:16" },
      { confidence: 0.91, ref: "Romans 8:28" },
    ])
  })

  it("keeps semantic replay hits out when semantic detection is switched off", () => {
    useSettingsStore.setState({ semanticDetectionEnabled: false })

    useDetectionStore.getState().addDetections(SEMANTIC_REPLAY_HITS)

    expect(useDetectionStore.getState().detections).toEqual([])
  })
})
