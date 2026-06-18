import { describe, expect, it } from "vitest"
import { buildVideoCommand, clampVideoVolume, videoSourceUrl } from "./broadcast-video-control"

describe("broadcast video control payloads", () => {
  it("clamps seek and volume command payloads", () => {
    expect(buildVideoCommand({ type: "seek", currentTime: -4 })).toEqual({
      type: "seek",
      currentTime: 0,
    })
    expect(buildVideoCommand({ type: "setVolume", volume: 1.7 })).toEqual({
      type: "setVolume",
      volume: 1,
    })
    expect(clampVideoVolume(Number.NaN)).toBe(1)
  })

  it("resolves video source URLs by source kind", () => {
    expect(
      videoSourceUrl({
        source: "local",
        videoId: "v1",
        title: "Local",
        videoPath: "C:\\Videos\\clip.mp4",
      }),
    ).toBe("C:\\Videos\\clip.mp4")
    expect(
      videoSourceUrl({
        source: "url",
        videoId: "v2",
        title: "Remote",
        url: "https://example.com/clip.webm",
      }),
    ).toBe("https://example.com/clip.webm")
    expect(
      videoSourceUrl({
        source: "youtube",
        videoId: "v3",
        title: "YT",
        youtubeId: "abcdefghijk",
      }),
    ).toBe("abcdefghijk")
  })
})
