// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueuePanel } from "./queue-panel"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import type { QueueItem, Verse } from "@/types"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function scriptureVerse(verse: number): Verse {
  return {
    id: verse,
    translation_id: 1,
    book_number: verse === 16 ? 43 : 19,
    book_name: verse === 16 ? "John" : "Psalm",
    book_abbreviation: verse === 16 ? "Jn" : "Ps",
    chapter: verse === 16 ? 3 : 23,
    verse,
    text:
      verse === 16
        ? "For God so loved the world."
        : "The Lord is my shepherd.",
  }
}

function queueItem(id: string, reference: string, verse: number): QueueItem {
  return {
    id,
    confidence: 1,
    source: "manual",
    added_at: 1,
    presentation: {
      kind: "scripture",
      reference,
      verse: scriptureVerse(verse),
    },
  }
}

describe("QueuePanel", () => {
  beforeEach(() => {
    useBroadcastStore.setState({
      isLive: false,
      previewItem: null,
      liveItem: null,
    })
    useQueueStore.setState({
      items: [
        queueItem("queue-john", "John 3:16", 16),
        queueItem("queue-psalm", "Psalm 23:1", 1),
      ],
      activeIndex: null,
      highlightedId: null,
      highlightedIds: [],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("shows ordered rows and keeps compact preview/live buttons actionable", () => {
    render(<QueuePanel />)

    expect(screen.getByText("01")).toBeTruthy()
    expect(screen.getByText("02")).toBeTruthy()
    expect(
      document
        .querySelector('[data-queue-idx="0"]')
        ?.getAttribute("draggable")
    ).not.toBe("true")
    expect(screen.getByRole("button", { name: "Drag John 3:16" })).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Preview Psalm 23:1" })
    )
    expect(useQueueStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().previewItem?.reference).toContain(
      "Psalm 23:1"
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Present live Psalm 23:1" })
    )
    expect(useQueueStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState()).toMatchObject({
      isLive: true,
      liveItem: expect.objectContaining({
        reference: expect.stringContaining("Psalm 23:1"),
      }),
    })
  })
})
