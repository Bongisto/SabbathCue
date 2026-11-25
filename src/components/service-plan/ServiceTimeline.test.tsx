// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ServiceItem } from "@/types/service-plan"
import { ServiceTimeline } from "./ServiceTimeline"

const ITEMS: ServiceItem[] = [
  {
    id: "item-1",
    order: 0,
    title: "Opening Prayer",
    kind: "general",
    status: "ready",
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  },
  {
    id: "item-2",
    order: 1,
    title: "Sermon",
    kind: "slide",
    status: "pending",
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  },
]

describe("ServiceTimeline (FU-20)", () => {
  afterEach(() => {
    cleanup()
  })

  it("reorders items using component-scoped drag ref without polluting window", () => {
    const onReorder = vi.fn()
    render(
      <ServiceTimeline
        items={ITEMS}
        activeItemId="item-1"
        performanceMode={false}
        onActivate={vi.fn()}
        onComplete={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const handles = screen.getAllByTitle("Reorder")
    fireEvent.dragStart(handles[0]!)
    expect(
      (window as unknown as { __serviceDragIndex?: number }).__serviceDragIndex,
    ).toBeUndefined()

    fireEvent.dragOver(handles[1]!)
    fireEvent.drop(handles[1]!)
    expect(onReorder).toHaveBeenCalledWith(0, 1)

    // Subsequent drop after dragEnd / drop does not replay stale drag index
    onReorder.mockClear()
    fireEvent.drop(handles[1]!)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it("blocks drag-over and drop reordering when performanceMode or readOnly turns on", () => {
    const onReorder = vi.fn()
    const { rerender } = render(
      <ServiceTimeline
        items={ITEMS}
        activeItemId="item-1"
        performanceMode={false}
        onActivate={vi.fn()}
        onComplete={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const handles = screen.getAllByTitle("Reorder")
    fireEvent.dragStart(handles[0]!)
    fireEvent.dragEnd(handles[0]!)

    // Even if performanceMode toggles on, drag/drop is guarded
    rerender(
      <ServiceTimeline
        items={ITEMS}
        activeItemId="item-1"
        performanceMode={true}
        onActivate={vi.fn()}
        onComplete={vi.fn()}
        onReorder={onReorder}
      />,
    )
    expect(screen.queryAllByTitle("Reorder")).toHaveLength(0)
    expect(onReorder).not.toHaveBeenCalled()
  })
})
