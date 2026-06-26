// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { VideoTimeUpdatePayload } from "@/lib/broadcast-video-control"
import type { PresentationRenderData } from "@/types"

let videoListener:
  | ((event: { payload: VideoTimeUpdatePayload }) => void)
  | null = null

const setVideoTransportMock = vi.fn()
const handleVideoEndedMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (
      event: string,
      callback: (event: { payload: VideoTimeUpdatePayload }) => void,
    ) => {
      if (event === "broadcast:video-timeupdate") videoListener = callback
      return Promise.resolve(() => {
        videoListener = null
      })
    },
  ),
}))

vi.mock("@/stores/broadcast-store", () => {
  const state = {
    videoTransport: null,
    videoMuted: false,
    videoVolume: 1,
    videoLoop: false,
    autoAdvanceVideoOnEnd: true,
    preferredAudioOutputDeviceId: "",
  }
  const useBroadcastStore = (selector: (s: typeof state) => unknown) =>
    selector(state)
  useBroadcastStore.getState = () => ({
    ...state,
    sendVideoCommand: vi.fn(),
    setVideoMuted: vi.fn(),
    setVideoVolume: vi.fn(),
    setVideoLoop: vi.fn(),
    setAutoAdvanceVideoOnEnd: vi.fn(),
    setPreferredAudioOutputDeviceId: vi.fn(),
    setVideoTransport: setVideoTransportMock,
    handleVideoEnded: handleVideoEndedMock,
  })
  return { useBroadcastStore }
})

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

function timeUpdate(outputId: string, ended: boolean): VideoTimeUpdatePayload {
  return {
    outputId,
    currentTime: 1,
    duration: 10,
    paused: false,
    muted: false,
    volume: 1,
    loop: false,
    ended,
  }
}

describe("VideoControlBar", () => {
  let container: HTMLDivElement
  let root: Root
  let VideoControlBar: typeof import("./VideoControlBar").VideoControlBar

  beforeEach(async () => {
    videoListener = null
    setVideoTransportMock.mockClear()
    handleVideoEndedMock.mockClear()
    ;({ VideoControlBar } = await import("./VideoControlBar"))
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

  it("ignores operator preview video updates and handles main output updates", async () => {
    await act(async () => {
      root.render(React.createElement(VideoControlBar, { item: videoItem }))
    })
    expect(videoListener).not.toBeNull()

    await act(async () => {
      videoListener?.({ payload: timeUpdate("operator", true) })
    })
    expect(setVideoTransportMock).not.toHaveBeenCalled()
    expect(handleVideoEndedMock).not.toHaveBeenCalled()

    await act(async () => {
      videoListener?.({ payload: timeUpdate("main", true) })
    })
    expect(setVideoTransportMock).toHaveBeenCalledWith(timeUpdate("main", true))
    expect(handleVideoEndedMock).toHaveBeenCalled()
  })
})
