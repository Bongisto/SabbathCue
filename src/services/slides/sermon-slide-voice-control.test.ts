import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  handleSermonSlideVoiceControl,
  parseSermonSlideCommand,
} from "./sermon-slide-voice-control"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { syncServiceContext } from "@/lib/service-plan/service-plan-live-effects"
import type { ServicePlan } from "@/types"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function plan(): ServicePlan {
  return {
    id: "plan-1",
    title: "Sabbath Service",
    status: "live",
    mode: "performance",
    createdAt: 1,
    updatedAt: 1,
    activeItemId: "item-1",
    eventLog: [],
    items: [
      {
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
            id: "slide-1",
            kind: "slide",
            label: "Opening",
            status: "ready",
            thumbnailUrl: "data:image/png;base64,one",
            order: 0,
          },
          {
            id: "slide-2",
            kind: "slide",
            label: "Appeal",
            status: "ready",
            thumbnailUrl: "data:image/png;base64,two",
            order: 1,
          },
        ],
      },
    ],
  }
}

describe("sermon slide voice control", () => {
  beforeEach(() => {
    const activePlan = plan()
    useServicePlanStore.setState({
      activePlan,
      serviceContext: syncServiceContext(activePlan),
    })
    useSermonSlideStore.getState().clear()
    useBroadcastStore.setState({ isLive: false, liveItem: null, previewItem: null })
  })

  it("parses slide navigation commands", () => {
    expect(parseSermonSlideCommand("next slide")).toEqual({ kind: "next" })
    expect(parseSermonSlideCommand("previous slide")).toEqual({ kind: "previous" })
    expect(parseSermonSlideCommand("go back slide")).toEqual({ kind: "previous" })
    expect(parseSermonSlideCommand("go to slide 2")).toEqual({
      kind: "jump",
      slideNumber: 2,
    })
    expect(parseSermonSlideCommand("today we talk about grace")).toBeNull()
  })

  it("parses spoken slide numbers directly after the cue", () => {
    expect(parseSermonSlideCommand("go to slide three")).toEqual({
      kind: "jump",
      slideNumber: 3,
    })
    expect(parseSermonSlideCommand("slide number three")).toEqual({
      kind: "jump",
      slideNumber: 3,
    })
    expect(parseSermonSlideCommand("slide twenty one")).toEqual({
      kind: "jump",
      slideNumber: 21,
    })
    expect(parseSermonSlideCommand("slide drieentwintig")).toEqual({
      kind: "jump",
      slideNumber: 23,
    })
  })

  it("keeps digit-tail behavior identical to the digits-only parser", () => {
    expect(parseSermonSlideCommand("slide 3 please")).toEqual({
      kind: "jump",
      slideNumber: 3,
    })
    expect(parseSermonSlideCommand("slide 2-3")).toEqual({
      kind: "jump",
      slideNumber: 2,
    })
    expect(parseSermonSlideCommand("slide 1000")).toBeNull()
    expect(parseSermonSlideCommand("slide 0")).toBeNull()
    expect(parseSermonSlideCommand("slide 2abc")).toBeNull()
  })

  it("does not jump on prose that merely contains a number after 'slide'", () => {
    // "the next slide shows three examples" must keep advancing, not jump.
    expect(parseSermonSlideCommand("the next slide shows three examples")).toEqual({
      kind: "next",
    })
    expect(parseSermonSlideCommand("slide deck has three parts")).toBeNull()
    expect(parseSermonSlideCommand("slide shows")).toBeNull()
  })

  it("presents requested active-item slide live", () => {
    expect(handleSermonSlideVoiceControl("slide 2")).toBe(true)

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().isLive).toBe(true)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("Sermon - Appeal")
  })

  it("advances from current slide", () => {
    expect(handleSermonSlideVoiceControl("slide 1")).toBe(true)
    expect(handleSermonSlideVoiceControl("next slide")).toBe(true)

    expect(useSermonSlideStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.hymnSlide?.screenId).toBe("slide-2")
  })

  it("ignores out-of-range commands", () => {
    expect(handleSermonSlideVoiceControl("slide 9")).toBe(false)
    expect(useBroadcastStore.getState().liveItem).toBeNull()
  })
})
