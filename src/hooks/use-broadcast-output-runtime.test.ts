// @vitest-environment jsdom
import React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn()
const mockEmitTo = vi.fn()
const mockWindowEmitTo = vi.fn()
const listeners = new Map<string, (event: { payload: unknown }) => void>()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => mockEmitTo(...args),
}))

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    label: "broadcast",
    listen: (eventName: string, callback: (event: { payload: unknown }) => void) => {
      listeners.set(eventName, callback)
      return Promise.resolve(() => listeners.delete(eventName))
    },
    emitTo: (...args: unknown[]) => mockWindowEmitTo(...args),
  }),
}))

function createCanvas() {
  const canvas = document.createElement("canvas")
  const context = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(1920 * 1080 * 4),
    })),
  }
  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
  return canvas
}

describe("useBroadcastOutputRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    listeners.clear()
    mockEmitTo.mockResolvedValue(undefined)
    mockWindowEmitTo.mockResolvedValue(undefined)
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === "push_ndi_frame") throw new Error("ndi down")
      if (command === "get_ndi_status") return null
      return undefined
    })
  })

  it("stops NDI after repeated frame push failures", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const root = createRoot(document.createElement("div"))

    function Probe() {
      useBroadcastOutputRuntime({ canvas, outputId: "main" })
      return null
    }

    await act(async () => {
      root.render(React.createElement(Probe))
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get("broadcast:ndi-config")?.({
        payload: {
          active: true,
          fps: 24,
          width: 1920,
          height: 1080,
        },
      })
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvoke.mock.calls.filter((call) => call[0] === "push_ndi_frame")).toHaveLength(3)
    expect(mockInvoke).toHaveBeenCalledWith("stop_ndi", { outputId: "main" })
    expect(mockEmitTo).toHaveBeenCalledWith(
      "main",
      "broadcast:output-error",
      expect.objectContaining({
        outputId: "main",
        kind: "ndi-frame",
        title: "NDI output stopped",
      }),
    )

    await act(async () => {
      root.unmount()
    })
    vi.useRealTimers()
  })
})
