// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { downscaleImageToThumbnail } from "./thumbnail"

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 4000
  height = 2000

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe("downscaleImageToThumbnail", () => {
  const originalCreateElement = document.createElement.bind(document)
  let toDataURL: ReturnType<typeof vi.fn>
  let canvas: HTMLCanvasElement | null

  beforeEach(() => {
    canvas = null
    toDataURL = vi.fn((mimeType: string, quality?: number) =>
      `data:${mimeType};quality=${quality ?? "none"}`
    )
    vi.stubGlobal("Image", MockImage)
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName)
      if (tagName === "canvas") {
        canvas = element as HTMLCanvasElement
        Object.defineProperty(element, "getContext", {
          value: () => ({ drawImage: vi.fn() }),
        })
        Object.defineProperty(element, "toDataURL", { value: toDataURL })
      }
      return element
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("keeps imported PNG output in PNG format at the requested presentation size", async () => {
    const result = await downscaleImageToThumbnail(
      "data:image/png;base64,abc",
      1920
    )

    expect(result).toBe("data:image/png;quality=none")
    expect(toDataURL).toHaveBeenCalledWith("image/png")
    expect(canvas?.width).toBe(1920)
    expect(canvas?.height).toBe(960)
  })

  it("keeps JPEG output as JPEG with higher presentation quality", async () => {
    const result = await downscaleImageToThumbnail(
      "data:image/jpeg;base64,abc",
      1920
    )

    expect(result).toBe("data:image/jpeg;quality=0.92")
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92)
  })
})
