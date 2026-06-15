// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DetectionsPanel } from "./detections-panel"
import type { DetectionResult, Verse } from "@/types"

const {
  clearDetectionsMock,
  detection,
  presentVerseMock,
  selectPreviewVerseMock,
  verse,
} = vi.hoisted(() => {
  const detection: DetectionResult = {
    verse_ref: "John 3:16",
    verse_text: "For God so loved the world.",
    book_name: "John",
    book_number: 43,
    chapter: 3,
    verse: 16,
    confidence: 0.96,
    source: "direct",
    auto_queued: false,
    transcript_snippet: "John chapter three verse sixteen",
    is_chapter_only: false,
  }

  const verse: Verse = {
    id: 0,
    translation_id: 1,
    book_number: 43,
    book_name: "John",
    book_abbreviation: "",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world.",
  }

  return {
    clearDetectionsMock: vi.fn(),
    detection,
    presentVerseMock: vi.fn(),
    selectPreviewVerseMock: vi.fn(),
    verse,
  }
})

vi.mock("@/hooks/use-detection", () => ({
  useDetection: () => ({ detections: [detection] }),
  detectionActions: {
    clearDetections: clearDetectionsMock,
    getDetectionStatus: vi.fn(async () => ({
      has_semantic: true,
      paraphrase_enabled: false,
    })),
  },
}))

vi.mock("@/lib/presentation-workflow", () => ({
  createScriptureQueueItem: vi.fn(() => ({ id: "queue-item" })),
  detectionToVerse: vi.fn(() => verse),
  presentVerse: (...args: unknown[]) => presentVerseMock(...args),
  selectPreviewVerse: (...args: unknown[]) => selectPreviewVerseMock(...args),
}))

vi.mock("@/stores/queue-store", () => ({
  useQueueStore: {
    getState: () => ({
      addOrFlashItem: vi.fn(),
    }),
  },
}))

describe("DetectionsPanel", () => {
  beforeEach(() => {
    selectPreviewVerseMock.mockClear()
    presentVerseMock.mockClear()
    clearDetectionsMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("previews a detection without navigating the Bible search panel", () => {
    render(<DetectionsPanel />)

    fireEvent.click(screen.getByRole("button", { name: /preview/i }))

    expect(selectPreviewVerseMock).toHaveBeenCalledWith(verse)
    expect(selectPreviewVerseMock).not.toHaveBeenCalledWith(
      verse,
      expect.objectContaining({ navigate: true }),
    )
  })

  it("presents a detection without navigating the Bible search panel", () => {
    render(<DetectionsPanel />)

    fireEvent.click(screen.getByRole("button", { name: /present/i }))

    expect(presentVerseMock).toHaveBeenCalledWith(verse)
    expect(presentVerseMock).not.toHaveBeenCalledWith(
      verse,
      expect.objectContaining({ navigate: true }),
    )
  })
})
