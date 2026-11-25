// @vitest-environment jsdom
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { buildServiceContext } from "@/lib/service-plan/service-context"
import type { ServicePlan } from "@/types/service-plan"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { RunServicePage } from "./RunServicePage"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("./ServiceLiveContextPanel", () => ({
  ServiceLiveContextPanel: () =>
    React.createElement("div", { "data-testid": "context-panel" }),
}))

vi.mock("./LiveProductionGrid", () => ({
  LiveProductionGrid: () =>
    React.createElement("div", { "data-testid": "production-grid" }),
}))

const PLAN: ServicePlan = {
  id: "plan-1",
  title: "Sabbath",
  status: "live",
  mode: "performance",
  activeItemId: "item-1",
  createdAt: 1,
  updatedAt: 1,
  eventLog: [],
  items: [
    {
      id: "item-1",
      order: 0,
      title: "Hymn",
      kind: "hymn",
      status: "active",
      scriptureRefs: [],
      hymnRefs: [{ hymnNumber: 1 }],
      mediaRefs: [],
      attachments: [],
      checklist: [],
    },
  ],
}

describe("RunServicePage (FU-49)", () => {
  beforeEach(() => {
    useServicePlanStore.setState({
      activePlan: PLAN,
      serviceContext: buildServiceContext(PLAN),
    })
    useHymnSlideStore.getState().setDeck(
      [
        {
          kind: "hymn",
          hymnId: "h1",
          hymnNumber: 1,
          hymnTitle: "Praise",
          screenId: "s1",
          slideIndex: 0,
          slideCount: 2,
          reference: "#1 Praise - 1/2",
          segments: [{ text: "Praise" }],
        },
        {
          kind: "hymn",
          hymnId: "h1",
          hymnNumber: 1,
          hymnTitle: "Praise",
          screenId: "s2",
          slideIndex: 1,
          slideCount: 2,
          reference: "#1 Praise - 2/2",
          segments: [{ text: "Lord" }],
        },
      ],
      0,
    )
    useSermonSlideStore.getState().clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders live deck navigation controls when only liveItem is a deck and never renders an empty bar", () => {
    useBroadcastStore.setState({
      isLive: true,
      previewItem: null,
      liveItem: {
        kind: "hymn",
        reference: "#1 Praise - 1/2",
        segments: [{ text: "Praise" }],
        hymnSlide: { screenId: "s1", slideIndex: 0, slideCount: 2 },
      },
    })

    const { rerender } = render(<RunServicePage />)
    expect(screen.getByText("Live deck navigation")).toBeTruthy()
    expect(screen.getByTitle("Next hymn slide")).toBeTruthy()

    useBroadcastStore.setState({
      isLive: false,
      previewItem: null,
      liveItem: null,
    })
    rerender(<RunServicePage />)
    expect(screen.queryByText(/deck navigation/i)).toBeNull()
  })
})
