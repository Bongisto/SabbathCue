// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isProgressiveVideoUrl,
  parseYoutubeId,
  readVideoMetadata,
} from "./library-video"

describe("library video helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("accepts only progressive HTTPS mp4/webm URLs", () => {
    expect(isProgressiveVideoUrl("https://cdn.example.com/clip.mp4")).toBe(true)
    expect(isProgressiveVideoUrl("https://cdn.example.com/clip.webm")).toBe(true)
    expect(isProgressiveVideoUrl("http://cdn.example.com/clip.mp4")).toBe(false)
    expect(isProgressiveVideoUrl("https://cdn.example.com/stream.m3u8")).toBe(false)
  })

  it("parses YouTube URLs and IDs including trailing slashes (FU-24)", () => {
    expect(parseYoutubeId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk")
    expect(parseYoutubeId("https://youtu.be/dQw4w9WgXcQ/")).toBe("dQw4w9WgXcQ")
    expect(parseYoutubeId("https://www.youtube.com/watch?v=abcdefghijk")).toBe(
      "abcdefghijk",
    )
    expect(parseYoutubeId("abcdefghijk")).toBe("abcdefghijk")
    expect(parseYoutubeId("not-valid")).toBeNull()
  })

  it("resolves without seeking when duration is 0 or non-finite and clears handlers (FU-24)", async () => {
    const mockVideo: Record<string, unknown> = {
      preload: "",
      muted: false,
      crossOrigin: null,
      duration: 0,
      videoWidth: 1280,
      videoHeight: 720,
      currentTime: 0,
      onloadedmetadata: null as (() => void) | null,
      onseeked: null as (() => void) | null,
      onerror: null as (() => void) | null,
      removeAttribute: vi.fn(),
      load: vi.fn(() => {
        // Verify handlers are already cleared before load() runs so onerror cannot loop.
        expect(mockVideo.onerror).toBeNull()
        expect(mockVideo.onloadedmetadata).toBeNull()
        expect(mockVideo.onseeked).toBeNull()
      }),
      set src(_value: string) {
        queueMicrotask(() => {
          ;(mockVideo.onloadedmetadata as (() => void) | null)?.()
        })
      },
    }

    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "video") return mockVideo as unknown as HTMLVideoElement
      return origCreateElement(tag)
    })

    const meta = await readVideoMetadata("https://cdn.example.com/zero.mp4")
    expect(meta).toEqual({ durationMs: 0, width: 1280, height: 720 })
    expect(mockVideo.load).toHaveBeenCalledTimes(1)
  })

  it("times out cleanly when metadata never arrives (FU-24)", async () => {
    vi.useFakeTimers()
    const mockVideo = {
      preload: "",
      muted: false,
      crossOrigin: null,
      onloadedmetadata: null,
      onseeked: null,
      onerror: null,
      removeAttribute: vi.fn(),
      load: vi.fn(),
      src: "",
    }
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "video") return mockVideo as unknown as HTMLVideoElement
      return origCreateElement(tag)
    })

    const pending = readVideoMetadata("https://cdn.example.com/hang.mp4")
    await vi.advanceTimersByTimeAsync(10_500)
    await expect(pending).resolves.toEqual({})
  })
})
