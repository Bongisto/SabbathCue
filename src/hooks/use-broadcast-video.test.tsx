// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBroadcastVideo } from "./use-broadcast-video"
import type { PresentationRenderData } from "@/types"
import type { VideoTransportCommand } from "@/lib/broadcast-video-control"

const { videoListenerRef, mockListen, mockEmitTo } = vi.hoisted(() => ({
  videoListenerRef: {
    current: null as
      | ((event: { payload: VideoTransportCommand }) => void)
      | null,
  },
  mockListen: vi.fn(),
  mockEmitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    listen: (event: string, callback: typeof videoListenerRef.current) =>
      mockListen(event, callback),
  }),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => mockEmitTo(...args),
}))

function TestBroadcastVideo({
  video,
  preferredSinkId,
}: {
  video: HTMLVideoElement
  preferredSinkId?: string
}) {
  useBroadcastVideo({
    video,
    item: null,
    outputId: "main",
    preferredSinkId,
  })
  return null
}

function TestBroadcastVideoWithItem({
  video,
  item,
}: {
  video: HTMLVideoElement
  item: PresentationRenderData | null
}) {
  useBroadcastVideo({ video, item, outputId: "operator" })
  return null
}

const videoItem: PresentationRenderData = {
  kind: "video",
  reference: "Welcome Video",
  segments: [{ text: "Welcome Video" }],
  video: {
    source: "url",
    videoId: "video-1",
    title: "Welcome Video",
    url: "https://cdn.example.com/welcome.mp4",
  },
}

describe("useBroadcastVideo", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    videoListenerRef.current = null
    mockEmitTo.mockClear()
    mockListen.mockReset()
    mockListen.mockImplementation(
      (event: string, callback: typeof videoListenerRef.current) => {
        if (event === "broadcast:video-control")
          videoListenerRef.current = callback
        return Promise.resolve(() => {
          videoListenerRef.current = null
        })
      }
    )
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("applies audio sink commands even before item state catches up", async () => {
    const video = document.createElement("video") as HTMLVideoElement & {
      setSinkId: (sinkId: string) => Promise<void>
    }
    const setSinkId = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    video.setSinkId = setSinkId

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({
        payload: { type: "setSinkId", sinkId: "speaker-1" },
      })
    })

    expect(setSinkId).toHaveBeenCalledWith("speaker-1")
  })

  it("does not require mocked play to return a promise", async () => {
    const video = document.createElement("video")
    const play = vi.fn()
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(
        <TestBroadcastVideoWithItem
          video={video}
          item={videoItem}
        />
      )
    })

    expect(play).toHaveBeenCalled()
  })

  it("rewinds before replaying an ended video", async () => {
    const video = document.createElement("video")
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      duration: { value: 10 },
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={videoItem} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    video.currentTime = 10
    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "play" } })
    })

    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalled()
  })

  it("restarts when the same source is loaded again", async () => {
    const video = document.createElement("video")
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "load", item: videoItem } })
    })
    video.currentTime = 7
    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "load", item: videoItem } })
    })

    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it("stops stale video even after item state has cleared", async () => {
    const video = document.createElement("video")
    const load = vi.fn()
    const pause = vi.fn()
    Object.defineProperties(video, {
      load: { value: load },
      pause: { value: pause },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    video.src = "https://cdn.example.com/welcome.mp4"

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "stop" } })
    })

    expect(pause).toHaveBeenCalled()
    expect(load).toHaveBeenCalled()
    expect(video.getAttribute("src")).toBeNull()
  })

  it("unloads an ended native video when a non-video item replaces it", async () => {
    const video = document.createElement("video")
    const load = vi.fn()
    const pause = vi.fn()
    Object.defineProperties(video, {
      duration: { value: 10 },
      load: { value: load },
      pause: { value: pause },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    const nextItem: PresentationRenderData = {
      kind: "scripture",
      reference: "John 3:16",
      segments: [{ text: "For God so loved the world", verseNumber: 16 }],
    }

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={videoItem} />)
    })

    video.currentTime = 10
    pause.mockClear()
    load.mockClear()

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={nextItem} />)
    })

    expect(pause).toHaveBeenCalled()
    expect(load).toHaveBeenCalled()
    expect(video.getAttribute("src")).toBeNull()
  })

  it("preserves preferred sinkId across <video> element remounts without tearing down the transport listener", async () => {
    const makeVideoEl = () => {
      const el = document.createElement("video") as HTMLVideoElement & {
        setSinkId: ReturnType<typeof vi.fn>
      }
      el.setSinkId = vi.fn().mockResolvedValue(undefined)
      Object.defineProperties(el, {
        load: { value: vi.fn() },
        pause: { value: vi.fn() },
        play: { value: vi.fn().mockResolvedValue(undefined) },
      })
      return el
    }

    const video1 = makeVideoEl()
    const video2 = makeVideoEl()

    await act(async () => {
      root.render(<TestBroadcastVideo video={video1} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())
    const initialListener = videoListenerRef.current

    await act(async () => {
      videoListenerRef.current?.({
        payload: { type: "setSinkId", sinkId: "speaker-1" },
      })
    })
    expect(video1.setSinkId).toHaveBeenCalledWith("speaker-1")

    await act(async () => {
      root.render(<TestBroadcastVideo video={video2} />)
    })

    expect(videoListenerRef.current).toBe(initialListener)
    expect(video2.setSinkId).toHaveBeenCalledWith("speaker-1")
  })

  it("emits broadcast:output-error to main when transport listener registration rejects on a broadcast window", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockListen.mockRejectedValueOnce(new Error("listen failed"))
    const video = document.createElement("video")
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(mockEmitTo).toHaveBeenCalledWith(
        "main",
        "broadcast:output-error",
        expect.objectContaining({
          outputId: "main",
          kind: "broadcast-sync",
          title: "Video controls unavailable",
        }),
      )
    })
    errorSpy.mockRestore()
  })
})
