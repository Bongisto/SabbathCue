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
const sendVideoCommandMock = vi.fn()
const setVideoMutedMock = vi.fn()
const setVideoVolumeMock = vi.fn()
const setVideoLoopMock = vi.fn()
const setAutoAdvanceVideoOnEndMock = vi.fn()

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
    sendVideoCommand: sendVideoCommandMock,
    setVideoMuted: setVideoMutedMock,
    setVideoVolume: setVideoVolumeMock,
    setVideoLoop: setVideoLoopMock,
    setAutoAdvanceVideoOnEnd: setAutoAdvanceVideoOnEndMock,
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
    durationMs: 10_000,
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
    sendVideoCommandMock.mockClear()
    setVideoMutedMock.mockClear()
    setVideoVolumeMock.mockClear()
    setVideoLoopMock.mockClear()
    setAutoAdvanceVideoOnEndMock.mockClear()
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

  it("prefers main output updates and falls back to operator updates", async () => {
    await act(async () => {
      root.render(React.createElement(VideoControlBar, { item: videoItem }))
    })
    expect(videoListener).not.toBeNull()

    // No projector window has reported yet: the in-app live copy is the
    // only playback source, so its updates drive the transport bar.
    await act(async () => {
      videoListener?.({ payload: timeUpdate("operator", false) })
    })
    expect(setVideoTransportMock).toHaveBeenCalledWith(
      timeUpdate("operator", false),
    )
    setVideoTransportMock.mockClear()

    await act(async () => {
      videoListener?.({ payload: timeUpdate("main", true) })
    })
    expect(setVideoTransportMock).toHaveBeenCalledWith(timeUpdate("main", true))
    expect(handleVideoEndedMock).toHaveBeenCalled()
    setVideoTransportMock.mockClear()
    handleVideoEndedMock.mockClear()

    // The projector window just reported, so it stays the source of truth
    // and the in-app copy's updates are ignored.
    await act(async () => {
      videoListener?.({ payload: timeUpdate("operator", true) })
    })
    expect(setVideoTransportMock).not.toHaveBeenCalled()
    expect(handleVideoEndedMock).not.toHaveBeenCalled()

    await act(async () => {
      videoListener?.({ payload: timeUpdate("alt", false) })
    })
    expect(setVideoTransportMock).not.toHaveBeenCalled()
  })

  it("wires transport buttons and toggles to video commands", async () => {
    await act(async () => {
      root.render(React.createElement(VideoControlBar, { item: videoItem }))
    })

    await act(async () => {
      ;(container.querySelector('button[title="Pause video"]') as HTMLButtonElement).click()
      ;(container.querySelector('button[title="Restart video"]') as HTMLButtonElement).click()
      ;(container.querySelector('button[title="Mute video"]') as HTMLButtonElement).click()
    })

    const [loop, autoAdvance] = Array.from(
      container.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]

    await act(async () => {
      loop.click()
      autoAdvance.click()
    })

    expect(sendVideoCommandMock).toHaveBeenCalledWith({ type: "pause" })
    expect(sendVideoCommandMock).toHaveBeenCalledWith({ type: "restart" })
    expect(setVideoMutedMock).toHaveBeenCalledWith(true)
    expect(setVideoLoopMock).toHaveBeenCalledWith(true)
    expect(setAutoAdvanceVideoOnEndMock).toHaveBeenCalledWith(false)
  })

  it("handles listen rejection and late listen resolution after unmount cleanly (FU-52)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { listen } = await import("@tauri-apps/api/event")

    // Case 1: listen() rejects
    vi.mocked(listen).mockRejectedValueOnce(new Error("event bus unavailable"))
    await act(async () => {
      root.render(React.createElement(VideoControlBar, { item: videoItem }))
    })
    expect(warnSpy).toHaveBeenCalledWith(
      "[video-control-bar] failed to listen for timeupdate",
      expect.any(Error),
    )

    // Case 2: listen() resolves after unmount — unlisten must be invoked immediately
    const lateUnlisten = vi.fn()
    let resolveListen: ((fn: () => void) => void) | null = null
    vi.mocked(listen).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveListen = resolve
        }),
    )

    const secondContainer = document.createElement("div")
    document.body.appendChild(secondContainer)
    const secondRoot = createRoot(secondContainer)
    await act(async () => {
      secondRoot.render(React.createElement(VideoControlBar, { item: videoItem }))
    })
    act(() => {
      secondRoot.unmount()
    })
    secondContainer.remove()

    await act(async () => {
      resolveListen?.(lateUnlisten)
    })
    expect(lateUnlisten).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})
