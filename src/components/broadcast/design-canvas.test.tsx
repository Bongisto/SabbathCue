// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DesignCanvas } from "./design-canvas"
import type { BroadcastTheme } from "@/types"

const fabricMocks = vi.hoisted(() => ({
  createdCanvases: [] as Array<{
    el: HTMLCanvasElement
    dispose: ReturnType<typeof vi.fn>
    setZoom: ReturnType<typeof vi.fn>
    getZoom: ReturnType<typeof vi.fn>
    setDimensions: ReturnType<typeof vi.fn>
  }>,
  findScaleToFit: vi.fn(() => 0.5),
}))

vi.mock("fabric", () => {
  class MockCanvas {
    el: HTMLCanvasElement
    zoom = 1
    viewportTransform = [1, 0, 0, 1, 0, 0]
    clipPath: unknown = null
    setZoom = vi.fn((z: number) => {
      this.zoom = z
    })
    getZoom = vi.fn(() => this.zoom)
    setDimensions = vi.fn()
    setViewportTransform = vi.fn((m: number[]) => {
      this.viewportTransform = m
    })
    add = vi.fn()
    centerObject = vi.fn()
    on = vi.fn()
    requestRenderAll = vi.fn()
    bringObjectToFront = vi.fn()
    dispose = vi.fn().mockResolvedValue(true)

    constructor(el: HTMLCanvasElement) {
      this.el = el
      fabricMocks.createdCanvases.push(this)
    }
  }

  class MockRect {
    left = 0
    top = 0
    width = 100
    height = 100
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts)
    }
    set = vi.fn((opts: Record<string, unknown>) => Object.assign(this, opts))
    setCoords = vi.fn()
    setPositionByOrigin = vi.fn()
    getCenterPoint = vi.fn(() => ({ x: 960, y: 540 }))
    getPointByOrigin = vi.fn(() => ({ x: 0, y: 0 }))
  }

  return {
    Canvas: MockCanvas,
    Rect: MockRect,
    Shadow: class {},
    Pattern: class {},
    Point: class {
      x: number
      y: number
      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
    },
    util: {
      findScaleToFit: fabricMocks.findScaleToFit,
    },
  }
})

vi.mock("@/lib/verse-renderer", () => ({
  renderVerse: vi.fn(() => ({
    referenceRect: { x: 10, y: 10, width: 100, height: 30 },
    verseRect: { x: 10, y: 50, width: 400, height: 100 },
  })),
}))

function makeTheme(id: string, imageUrl?: string): BroadcastTheme {
  return {
    id,
    name: `Theme ${id}`,
    builtin: false,
    createdAt: 1,
    updatedAt: 1,
    resolution: { width: 1920, height: 1080 },
    background: {
      type: imageUrl ? "image" : "solid",
      color: "#000000",
      gradient: null,
      image: imageUrl
        ? { url: imageUrl, fit: "cover", blur: 0, brightness: 100, tint: null }
        : null,
    },
    layout: { padding: 80, referencePosition: "above", referenceGap: 16 },
    verseText: {
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 600,
      lineHeight: 1.3,
      color: "#ffffff",
      align: "center",
    },
    reference: {
      fontFamily: "Inter",
      fontSize: 28,
      fontWeight: 500,
      color: "#cccccc",
      position: "above",
    },
    verseNumbers: { visible: false, color: "#cccccc", sizeRatio: 0.7 },
    textBox: { enabled: false, color: "#000000", opacity: 0.5, borderRadius: 8, padding: 16 },
  } as unknown as BroadcastTheme
}

const designerState = vi.hoisted(() => ({
  editingThemeId: "theme-1" as string | null,
  draftTheme: null as BroadcastTheme | null,
  selectedElement: null as "verse" | "reference" | null,
  setSelectedElement: vi.fn(),
  updateDraft: vi.fn(),
}))

vi.mock("@/stores/broadcast/designer-store", () => {
  const hook = (selector: (state: typeof designerState) => unknown) => selector(designerState)
  hook.getState = () => designerState
  return { useBroadcastDesignerStore: hook }
})

beforeEach(() => {
  vi.clearAllMocks()
  fabricMocks.createdCanvases.length = 0
  designerState.editingThemeId = "theme-1"
  designerState.draftTheme = makeTheme("theme-1")
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as unknown as CanvasRenderingContext2D
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("DesignCanvas (FU-39)", () => {
  it("keys canvas element by editingThemeId and cancels initial autoZoom RAF on cleanup", () => {
    const rafCallbacks = new Map<number, FrameRequestCallback>()
    let nextId = 1
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = nextId++
      rafCallbacks.set(id, cb)
      return id
    })
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      rafCallbacks.delete(id)
    })

    const view = render(<DesignCanvas />)
    expect(fabricMocks.createdCanvases).toHaveLength(1)
    const firstEl = fabricMocks.createdCanvases[0].el

    designerState.editingThemeId = "theme-2"
    designerState.draftTheme = makeTheme("theme-2")
    view.rerender(<DesignCanvas />)

    expect(fabricMocks.createdCanvases).toHaveLength(2)
    expect(fabricMocks.createdCanvases[1].el).not.toBe(firstEl)
    expect(fabricMocks.createdCanvases[0].dispose).toHaveBeenCalledTimes(1)
    expect(cancelSpy).toHaveBeenCalled()

    view.unmount()
    expect(rafCallbacks.size).toBe(0)
  })

  it("early-returns in autoZoom when container dimensions are 0x0", () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    const { container } = render(<DesignCanvas />)
    const canvasWrapper = container.querySelector(".relative.min-h-0.flex-1") as HTMLElement
    Object.defineProperty(canvasWrapper, "offsetWidth", { configurable: true, value: 0 })
    Object.defineProperty(canvasWrapper, "offsetHeight", { configurable: true, value: 0 })

    // Run queued RAFs — autoZoom should early return without calling findScaleToFit or setting 0x0
    act(() => {
      while (rafQueue.length > 0) rafQueue.shift()?.(0)
    })

    expect(fabricMocks.findScaleToFit).not.toHaveBeenCalled()
    expect(fabricMocks.createdCanvases[0].setZoom).not.toHaveBeenCalled()
  })

  it("does not emit unhandled rejection when background image fails to load in ensureImage", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on("unhandledRejection", onUnhandled)

    class FailingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal("Image", FailingImage)
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      queueMicrotask(() => cb(0))
      return 1
    })

    designerState.draftTheme = makeTheme("theme-img", "https://broken.example/bg.png")
    render(<DesignCanvas />)

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    process.off("unhandledRejection", onUnhandled)
    expect(warnSpy).toHaveBeenCalled()
    expect(unhandled).toHaveLength(0)
    warnSpy.mockRestore()
  })
})
