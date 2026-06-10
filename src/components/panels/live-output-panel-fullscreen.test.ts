import { describe, expect, it, vi } from "vitest"
import {
  isPanelFullscreen,
  nextFullscreenLayout,
  togglePanelFullscreen,
} from "./live-output-panel-fullscreen"

describe("live output panel fullscreen wiring", () => {
  it("only reports fullscreen when the live panel itself owns fullscreen", () => {
    const panel = { id: "live-panel" } as unknown as Element
    const otherElement = { id: "other" } as unknown as Element

    expect(isPanelFullscreen(panel, panel)).toBe(true)
    expect(isPanelFullscreen(panel, otherElement)).toBe(false)
    expect(isPanelFullscreen(panel, null)).toBe(false)
    expect(isPanelFullscreen(null, panel)).toBe(false)
  })

  it("requests fullscreen on the live panel when it is not already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const panel = { requestFullscreen } as unknown as HTMLElement

    await togglePanelFullscreen(panel, null, exitFullscreen)

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it("exits fullscreen when the live panel is already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const panel = { requestFullscreen } as unknown as HTMLElement

    await togglePanelFullscreen(panel, panel, exitFullscreen)

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it("predicts the layout after a toggle from either direction", () => {
    const panel = { id: "live-panel" } as unknown as Element
    const other = { id: "other" } as unknown as Element

    expect(nextFullscreenLayout(panel, null)).toBe(true)
    expect(nextFullscreenLayout(panel, other)).toBe(true)
    expect(nextFullscreenLayout(panel, panel)).toBe(false)
    expect(nextFullscreenLayout(null, null)).toBe(false)
  })

  it("applies the fullscreen layout before the fullscreen request resolves", async () => {
    // Regression: the layout used to flip only on the fullscreenchange event,
    // so the panel painted a frame of windowed chrome at fullscreen size —
    // the enter/exit flash.
    const layoutChanges: boolean[] = []
    let layoutAtRequestTime: boolean | undefined
    const requestFullscreen = vi.fn().mockImplementation(() => {
      layoutAtRequestTime = layoutChanges.at(-1)
      return Promise.resolve()
    })
    const panel = { requestFullscreen } as unknown as HTMLElement

    await togglePanelFullscreen(panel, null, vi.fn(), (fullscreen) => {
      layoutChanges.push(fullscreen)
    })

    expect(layoutAtRequestTime).toBe(true)
    expect(layoutChanges).toEqual([true])
  })

  it("applies the windowed layout before exit resolves", async () => {
    const layoutChanges: boolean[] = []
    let layoutAtExitTime: boolean | undefined
    const exitFullscreen = vi.fn().mockImplementation(() => {
      layoutAtExitTime = layoutChanges.at(-1)
      return Promise.resolve()
    })
    const panel = { requestFullscreen: vi.fn() } as unknown as HTMLElement

    await togglePanelFullscreen(panel, panel, exitFullscreen, (fullscreen) => {
      layoutChanges.push(fullscreen)
    })

    expect(layoutAtExitTime).toBe(false)
    expect(layoutChanges).toEqual([false])
  })

  it("rolls the optimistic layout back when the fullscreen request fails", async () => {
    const layoutChanges: boolean[] = []
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"))
    const panel = { requestFullscreen } as unknown as HTMLElement

    await expect(
      togglePanelFullscreen(panel, null, vi.fn(), (fullscreen) => {
        layoutChanges.push(fullscreen)
      }),
    ).rejects.toThrow("denied")

    expect(layoutChanges).toEqual([true, false])
  })
})

