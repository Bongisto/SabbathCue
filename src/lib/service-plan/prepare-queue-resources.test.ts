import { beforeEach, describe, expect, it, vi } from "vitest"
import { enqueuePreparedResourcesForItem } from "./prepare-queue-resources"
import { useQueueStore } from "@/stores/queue-store"
import type { ServiceItem } from "@/types/service-plan"

vi.mock("@/services/hymnal/hymnal-repository", () => ({
  getHymnByNumber: vi.fn(async (number: number) => ({
    id: `hymn-${number}`,
    number,
    title: `Hymn ${number}`,
    sections: [{ id: "s1", label: "Verse 1", lines: ["Line one", "Line two"] }],
  })),
}))

vi.mock("@/services/hymnal/generate-hymn-screens", () => ({
  generateHymnScreens: vi.fn(() => [
    {
      id: "screen-0",
      hymnId: "hymn-1",
      hymnNumber: 1,
      hymnTitle: "Hymn 1",
      sectionLabel: "Verse 1",
      sectionScreenIndex: 0,
      sectionScreenCount: 2,
      screenIndex: 0,
      totalScreens: 2,
      lines: ["Line one"],
    },
    {
      id: "screen-1",
      hymnId: "hymn-1",
      hymnNumber: 1,
      hymnTitle: "Hymn 1",
      sectionLabel: "Verse 1",
      sectionScreenIndex: 1,
      sectionScreenCount: 2,
      screenIndex: 1,
      totalScreens: 2,
      lines: ["Line two"],
    },
  ]),
}))

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    loadBooks: vi.fn(async () => []),
    fetchVerse: vi.fn(async () => null),
  },
}))

function itemWithHymn(): ServiceItem {
  return {
    id: "item-1",
    order: 0,
    title: "Opening hymn",
    kind: "hymn",
    status: "active",
    scriptureRefs: [],
    hymnRefs: [{ hymnNumber: 1 }],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  }
}

function itemWithMedia(): ServiceItem {
  return {
    id: "item-2",
    order: 0,
    title: "Welcome video",
    kind: "media",
    status: "active",
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [{ attachmentId: "media-1", label: "Welcome" }],
    attachments: [],
    checklist: [],
  }
}

describe("enqueuePreparedResourcesForItem", () => {
  beforeEach(() => {
    useQueueStore.setState({ items: [], activeIndex: null })
  })

  it("enqueues the full grouped hymn deck for a hymn item", async () => {
    const queued = await enqueuePreparedResourcesForItem(itemWithHymn())
    const items = useQueueStore.getState().items

    expect(queued).toBe(2)
    expect(items).toHaveLength(2)
    expect(items.every((entry) => entry.presentation.kind === "hymn")).toBe(
      true
    )
    expect(items.map((entry) => entry.presentation.reference)).toEqual([
      "[Plan] #1 Hymn 1 - Verse 1 1 of 2",
      "[Plan] #1 Hymn 1 - Verse 1 2 of 2",
    ])
    expect(items[0].hymnGroup?.groupId).toBe(items[1].hymnGroup?.groupId)
    expect(items[0].hymnGroup?.itemCount).toBe(2)
    expect(items[0].hymnDeck).toHaveLength(2)
    expect(items[0].hymnDeck?.[1]?.reference).toBe(
      "[Plan] #1 Hymn 1 - Verse 1 2 of 2"
    )
    expect(items[0].source).toBe("service-plan")
  })

  it("adds the plan prefix exactly once for prepared media", async () => {
    await enqueuePreparedResourcesForItem(itemWithMedia())

    expect(useQueueStore.getState().items[0].presentation.reference).toBe(
      "[Plan] Media - Welcome"
    )
  })

  it("enqueues sermon slides in attachment.order with slideDeck attached (FU-23)", async () => {
    const sermonItem: ServiceItem = {
      id: "item-sermon",
      order: 0,
      title: "Sermon",
      kind: "slide",
      status: "active",
      scriptureRefs: [],
      hymnRefs: [],
      mediaRefs: [],
      attachments: [
        {
          id: "slide-b",
          kind: "slide",
          label: "Point 2",
          status: "ready",
          thumbnailUrl: "data:image/png;base64,b",
          order: 1,
        },
        {
          id: "slide-a",
          kind: "slide",
          label: "Point 1",
          status: "ready",
          thumbnailUrl: "data:image/png;base64,a",
          order: 0,
        },
        {
          id: "doc-1",
          kind: "document",
          label: "Handout.pdf",
          status: "pending",
        },
      ],
      checklist: [],
    }

    const queued = await enqueuePreparedResourcesForItem(sermonItem)
    const items = useQueueStore.getState().items

    expect(queued).toBe(3)
    expect(items.map((i) => i.presentation.reference)).toEqual([
      "[Plan] Sermon - Point 1",
      "[Plan] Sermon - Point 2",
      "[Plan] Document - Handout.pdf",
    ])
    expect(items[0].slideDeck).toHaveLength(2)
    expect(items[0].slideDeck?.map((s) => s.slideId)).toEqual(["slide-a", "slide-b"])
    expect(items[0].slideDeck?.map((s) => s.reference)).toEqual([
      "[Plan] Sermon - Point 1",
      "[Plan] Sermon - Point 2",
    ])
    expect(items[1].slideDeck).toHaveLength(2)
    expect(items[2].slideDeck).toBeUndefined()
  })
})
