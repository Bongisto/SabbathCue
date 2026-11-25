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

describe("video-slice handleVideoEnded (FL-01)", () => {
  beforeEach(() => {
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    vi.resetModules()
  })

  it("holds on the last queue item instead of looping it when videoLoop is false", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { useQueueStore } = await import("@/stores/queue-store")
    const video1 = {
      id: "q-vid-1",
      confidence: 1,
      source: "manual" as const,
      added_at: 1,
      presentation: {
        kind: "video" as const,
        videoId: "v1",
        title: "Video 1",
        source: "url" as const,
        url: "https://cdn.example.com/v1.mp4",
        reference: "Video 1",
        segments: [{ text: "Video 1" }],
      },
    }
    const video2 = {
      id: "q-vid-2",
      confidence: 1,
      source: "manual" as const,
      added_at: 2,
      presentation: {
        kind: "video" as const,
        videoId: "v2",
        title: "Video 2",
        source: "url" as const,
        url: "https://cdn.example.com/v2.mp4",
        reference: "Video 2",
        segments: [{ text: "Video 2" }],
      },
    }
    useQueueStore.setState({ items: [video1, video2], activeIndex: 1 })
    useBroadcastStore.setState({
      isLive: true,
      videoLoop: false,
      autoAdvanceVideoOnEnd: true,
      liveItem: {
        kind: "video",
        reference: "Video 2",
        segments: [{ text: "Video 2" }],
        video: {
          source: "url",
          videoId: "v2",
          title: "Video 2",
          url: "https://cdn.example.com/v2.mp4",
        },
      },
      liveQueueItemId: "q-vid-2",
    })

    emitToMock.mockClear()
    const decision = useBroadcastStore.getState().handleVideoEnded()

    expect(decision).toBe("hold")
    expect(useQueueStore.getState().activeIndex).toBe(1)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("does not advance an unrelated queue when a standalone video ends", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { useQueueStore } = await import("@/stores/queue-store")
    useQueueStore.setState({
      items: [
        {
          id: "q-1",
          confidence: 1,
          source: "manual",
          added_at: 1,
          presentation: {
            kind: "scripture",
            reference: "John 3:16",
            verse: {
              id: 1,
              translation_id: 1,
              book_number: 43,
              book_name: "John",
              book_abbreviation: "John",
              chapter: 3,
              verse: 16,
              text: "For God so loved the world",
            },
          },
        },
        {
          id: "q-2",
          confidence: 1,
          source: "manual",
          added_at: 2,
          presentation: {
            kind: "scripture",
            reference: "Psalm 23:1",
            verse: {
              id: 2,
              translation_id: 1,
              book_number: 19,
              book_name: "Psalms",
              book_abbreviation: "Ps",
              chapter: 23,
              verse: 1,
              text: "The Lord is my shepherd",
            },
          },
        },
      ],
      activeIndex: 0,
    })
    useBroadcastStore.setState({
      isLive: true,
      videoLoop: false,
      autoAdvanceVideoOnEnd: true,
      liveQueueItemId: null,
      liveItem: {
        kind: "video",
        reference: "Standalone Video",
        segments: [{ text: "Standalone Video" }],
        video: {
          source: "url",
          videoId: "standalone",
          title: "Standalone Video",
          url: "https://cdn.example.com/standalone.mp4",
        },
      },
    })

    emitToMock.mockClear()
    const decision = useBroadcastStore.getState().handleVideoEnded()

    expect(decision).toBe("hold")
    expect(useQueueStore.getState().activeIndex).toBe(0)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("Standalone Video")
  })

  it("advances to the next queue item and preserves liveQueueItemId when a queued video ends", async () => {
    const { useBroadcastStore } = await import("@/stores/broadcast-store")
    const { useQueueStore } = await import("@/stores/queue-store")
    const video1 = {
      id: "q-vid-1",
      confidence: 1,
      source: "manual" as const,
      added_at: 1,
      presentation: {
        kind: "video" as const,
        videoId: "v1",
        title: "Video 1",
        source: "url" as const,
        url: "https://cdn.example.com/v1.mp4",
        reference: "Video 1",
        segments: [{ text: "Video 1" }],
      },
    }
    const video2 = {
      id: "q-vid-2",
      confidence: 1,
      source: "manual" as const,
      added_at: 2,
      presentation: {
        kind: "video" as const,
        videoId: "v2",
        title: "Video 2",
        source: "url" as const,
        url: "https://cdn.example.com/v2.mp4",
        reference: "Video 2",
        segments: [{ text: "Video 2" }],
      },
    }
    useQueueStore.setState({ items: [video1, video2], activeIndex: 0 })
    useBroadcastStore.setState({
      isLive: true,
      videoLoop: false,
      autoAdvanceVideoOnEnd: true,
      liveQueueItemId: "q-vid-1",
      liveItem: {
        kind: "video",
        reference: "Video 1",
        segments: [{ text: "Video 1" }],
        video: {
          source: "url",
          videoId: "v1",
          title: "Video 1",
          url: "https://cdn.example.com/v1.mp4",
        },
      },
    })

    const decision = useBroadcastStore.getState().handleVideoEnded()

    expect(decision).toBe("advance")
    expect(useQueueStore.getState().activeIndex).toBe(1)
    expect(useBroadcastStore.getState().liveItem?.reference).toBe("Video 2")
    expect(useBroadcastStore.getState().liveQueueItemId).toBe("q-vid-2")
  })
})
