import { describe, expect, it } from "vitest"
import { buildSermonSlideDeck, getOrderedSermonSlideAttachments } from "./sermon-slide-deck"
import type { ServiceItem } from "@/types"

function item(): ServiceItem {
  return {
    id: "item-1",
    order: 0,
    title: "Sermon",
    kind: "slide",
    status: "active",
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [],
    checklist: [],
    attachments: [
      {
        id: "media-1",
        kind: "media",
        label: "clip.mp4",
        status: "ready",
      },
      {
        id: "slide-2",
        kind: "slide",
        label: "Second Point",
        status: "ready",
        thumbnailUrl: "data:image/png;base64,two",
        order: 1,
      },
      {
        id: "slide-1",
        kind: "slide",
        label: "Opening",
        status: "ready",
        thumbnailUrl: "data:image/png;base64,one",
        order: 0,
      },
    ],
  }
}

describe("sermon slide deck", () => {
  it("builds ordered slide deck items from labelled image attachments", () => {
    const deck = buildSermonSlideDeck(item())

    expect(deck).toHaveLength(2)
    expect(deck[0]).toMatchObject({
      kind: "slideDeck",
      slideId: "slide-1",
      sectionLabel: "Opening",
      slideIndex: 0,
      slideCount: 2,
      slidePath: "data:image/png;base64,one",
    })
    expect(deck[1].sectionLabel).toBe("Second Point")
  })

  it("defaults slides to no theme and propagates slidesApplyTheme when set", () => {
    expect(buildSermonSlideDeck(item()).every((slide) => !slide.applyTheme)).toBe(
      true
    )

    const themed = buildSermonSlideDeck({ ...item(), slidesApplyTheme: true })
    expect(themed.every((slide) => slide.applyTheme === true)).toBe(true)
  })

  it("ignores non-slide media and slides without image data", () => {
    const attachments = getOrderedSermonSlideAttachments({
      ...item(),
      attachments: [
        { id: "media", kind: "media", label: "clip", status: "ready" },
        { id: "slide", kind: "slide", label: "missing", status: "ready" },
      ],
    })

    expect(attachments).toEqual([])
  })
})
