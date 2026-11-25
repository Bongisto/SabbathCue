// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { buildServiceContext } from "@/lib/service-plan/service-context"
import type { ServicePlan } from "@/types/service-plan"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { ServicePlanEditor } from "./ServicePlanEditor"

const openMock = vi.fn()
const invokeTauriMock = vi.fn()
const importPowerPointSlidesMock = vi.fn()
const enqueuePreparedMock = vi.fn().mockResolvedValue(undefined)
const practicePreviewMock = vi.fn().mockResolvedValue(undefined)

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
}))

vi.mock("@/lib/tauri-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tauri-runtime")>()
  return {
    ...actual,
    invokeTauri: (...args: unknown[]) => invokeTauriMock(...args),
  }
})

vi.mock("@/lib/powerpoint-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/powerpoint-import")>()
  return {
    ...actual,
    importPowerPointSlides: (...args: unknown[]) =>
      importPowerPointSlidesMock(...args),
  }
})

function makePlan(): ServicePlan {
  return {
    id: "plan-1",
    title: "Sabbath Plan",
    status: "practice",
    mode: "practice",
    activeItemId: "item-1",
    createdAt: 1,
    updatedAt: 1,
    eventLog: [],
    items: [
      {
        id: "item-1",
        order: 0,
        title: "Opening Hymn",
        kind: "hymn",
        status: "active",
        scriptureRefs: [],
        hymnRefs: [{ hymnNumber: 1 }],
        mediaRefs: [],
        attachments: [],
        checklist: [],
      },
      {
        id: "item-2",
        order: 1,
        title: "Sermon Slides",
        kind: "slide",
        status: "pending",
        scriptureRefs: [],
        hymnRefs: [],
        mediaRefs: [],
        attachments: [],
        checklist: [],
      },
    ],
  }
}

describe("ServicePlanEditor & ServiceItemDetailsPanel (FU-31, FU-32)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invokeTauriMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_service_attachment_limits") {
        return { slide: 10_000_000, document: 100_000_000, media: 750_000_000 }
      }
      return ""
    })
    const plan = makePlan()
    useServicePlanStore.setState({
      activePlan: plan,
      serviceContext: buildServiceContext(plan),
      enqueuePreparedResources: enqueuePreparedMock,
      practicePreviewActiveItem: practicePreviewMock,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("passes selectedItem.id to enqueuePreparedResources and practicePreviewActiveItem (FU-32)", async () => {
    await act(async () => {
      render(<ServicePlanEditor />)
    })

    // Select item-2 while activeItemId remains item-1
    await act(async () => {
      fireEvent.click(screen.getByText("Sermon Slides"))
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Queue prepared resources" }),
    )
    expect(enqueuePreparedMock).toHaveBeenCalledWith("item-2")

    fireEvent.click(screen.getByRole("button", { name: "Practice preview" }))
    expect(practicePreviewMock).toHaveBeenCalledWith("item-2")
  })

  it("surfaces real rejection messages and resets error state when switching items (FU-31)", async () => {
    invokeTauriMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_service_attachment_limits") {
        return { slide: 10_000_000, document: 100_000_000, media: 750_000_000 }
      }
      if (cmd === "validate_service_attachment_path") {
        throw "Unsupported image format: .bmp"
      }
      return ""
    })
    openMock.mockResolvedValueOnce(["/tmp/slide.bmp"])

    await act(async () => {
      render(<ServicePlanEditor />)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload png \/ images/i }))
    })

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Unsupported image format: .bmp",
      ),
    )

    // Switch to item-2 -> key={selectedItem.id} clears the stale error banner
    await act(async () => {
      fireEvent.click(screen.getByText("Sermon Slides"))
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("preserves concurrent PDF additions when async PowerPoint import finishes (FU-31)", async () => {
    let resolvePptx:
      | ((slides: Array<{ index: number; dataUrl: string; label: string; textLines: string[] }>) => void)
      | undefined
    importPowerPointSlidesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePptx = resolve
        }),
    )
    openMock.mockResolvedValueOnce("/tmp/sermon.pptx")

    await act(async () => {
      render(<ServicePlanEditor />)
    })
    await act(async () => {
      fireEvent.click(screen.getByText("Sermon Slides"))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /import powerpoint/i }))
    })

    await waitFor(() => expect(resolvePptx).toBeTypeOf("function"))

    // Simulate a PDF attachment being added to item-2 while PPTX import is in flight
    await act(async () => {
      useServicePlanStore.getState().updateItem("item-2", {
        attachments: [
          {
            id: "pdf-1",
            kind: "document",
            label: "Notes.pdf",
            status: "pending",
          },
        ],
      })
      resolvePptx?.([
        {
          index: 0,
          dataUrl: "data:image/png;base64,slide1",
          label: "sermon — Slide 1",
          textLines: ["Slide 1"],
        },
      ])
    })

    await waitFor(() => {
      const updated = useServicePlanStore
        .getState()
        .activePlan?.items.find((i) => i.id === "item-2")
      expect(updated?.attachments.map((a) => a.label)).toEqual([
        "sermon — Slide 1",
        "Notes.pdf",
      ])
    })
  })
})
