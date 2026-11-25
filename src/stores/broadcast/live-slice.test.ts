import { beforeEach, describe, expect, it, vi } from "vitest"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

describe("live-slice video audio sink sync (FL-02)", () => {
  beforeEach(() => {
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    vi.resetModules()
  })

  it("resyncs preferred audio sink on syncBroadcastOutputFor when a video is live", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    useBroadcastStore.setState({
      isLive: true,
      preferredAudioOutputDeviceId: "speaker-1",
      liveItem: {
        kind: "video",
        reference: "Welcome Video",
        segments: [{ text: "Welcome Video" }],
        video: {
          source: "url",
          videoId: "video-1",
          title: "Welcome Video",
          url: "https://cdn.example.com/welcome.mp4",
        },
      },
    })

    emitToMock.mockClear()
    useBroadcastStore.getState().syncBroadcastOutputFor("main")

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:video-control",
      {
        type: "setSinkId",
        sinkId: "speaker-1",
      },
    )
  })
})
