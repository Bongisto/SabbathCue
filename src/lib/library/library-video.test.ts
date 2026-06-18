import { describe, expect, it } from "vitest"
import { isProgressiveVideoUrl, parseYoutubeId } from "./library-video"

describe("library video helpers", () => {
  it("accepts only progressive HTTPS mp4/webm URLs", () => {
    expect(isProgressiveVideoUrl("https://cdn.example.com/clip.mp4")).toBe(true)
    expect(isProgressiveVideoUrl("https://cdn.example.com/clip.webm")).toBe(true)
    expect(isProgressiveVideoUrl("http://cdn.example.com/clip.mp4")).toBe(false)
    expect(isProgressiveVideoUrl("https://cdn.example.com/stream.m3u8")).toBe(false)
  })

  it("parses YouTube URLs and IDs", () => {
    expect(parseYoutubeId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk")
    expect(parseYoutubeId("https://www.youtube.com/watch?v=abcdefghijk")).toBe(
      "abcdefghijk",
    )
    expect(parseYoutubeId("abcdefghijk")).toBe("abcdefghijk")
    expect(parseYoutubeId("not-valid")).toBeNull()
  })
})
