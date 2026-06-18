import { describe, it, expect } from "vitest"
import { getPresentationRenderData } from "./presentation"
import type { EgwPresentationItemData, VideoPresentationItemData } from "./presentation"

describe("EGW presentation render data", () => {
  it("maps an EGW item to reference + segments", () => {
    const item: EgwPresentationItemData = {
      kind: "egw",
      paragraph: {
        id: 1,
        book_number: 1,
        book_title: "Patriarchs and Prophets",
        chapter: 1,
        chapter_title: "Why Was Sin Permitted?",
        paragraph: 3,
        text: "God is love.",
      },
      reference: "Patriarchs and Prophets 1:3",
      slideId: "egw-1-0",
      slideIndex: 0,
      slideCount: 1,
      segments: [{ text: "God is love." }],
    }
    const render = getPresentationRenderData(item)
    expect(render.kind).toBe("egw")
    expect(render.reference).toBe("Patriarchs and Prophets 1:3")
    expect(render.segments).toEqual([{ text: "God is love." }])
  })

  it("maps a video item to reference + source carrier", () => {
    const item: VideoPresentationItemData = {
      kind: "video",
      videoId: "video-1",
      title: "Welcome",
      source: "local",
      videoPath: "C:\\Videos\\welcome.mp4",
      reference: "Welcome",
      segments: [{ text: "Welcome" }],
    }
    const render = getPresentationRenderData(item)
    expect(render.kind).toBe("video")
    expect(render.reference).toBe("Welcome")
    expect(render.video).toMatchObject({
      source: "local",
      videoId: "video-1",
      videoPath: "C:\\Videos\\welcome.mp4",
    })
  })
})
