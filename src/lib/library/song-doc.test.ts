import { describe, expect, it } from "vitest"
import { deckToSongDoc, parseSongText, songDocToDeck } from "./song-doc"
import type { HymnPresentationItemData } from "@/types"

describe("song document mappers", () => {
  it("creates hymn presentation slides from song sections", () => {
    const deck = songDocToDeck({
      title: "Amazing Grace",
      sections: [
        {
          kind: "verse",
          index: 1,
          lines: ["Amazing grace how sweet the sound", "That saved a soul like me"],
        },
      ],
    })

    expect(deck).toHaveLength(1)
    expect(deck[0]).toMatchObject({
      kind: "hymn",
      hymnTitle: "Amazing Grace",
      slideIndex: 0,
      slideCount: 1,
    })
    expect(deck[0].segments.map((segment) => segment.text)).toEqual([
      "Amazing grace how sweet the sound",
      "That saved a soul like me",
    ])
  })

  it("parses pasted song text into ordered sections", () => {
    const song = parseSongText(
      "Blessed Assurance",
      "Blessed assurance\nJesus is mine\n\n---\n\nThis is my story",
    )

    expect(song.title).toBe("Blessed Assurance")
    expect(song.sections).toHaveLength(2)
    expect(song.sections[0]).toMatchObject({ kind: "verse", index: 1 })
    expect(song.sections[1]).toMatchObject({ kind: "chorus", index: 2 })
  })

  it("copies an existing hymn deck into an editable song document", () => {
    const slide: HymnPresentationItemData = {
      kind: "hymn",
      hymnId: "hymn-1",
      hymnNumber: 1,
      hymnTitle: "Praise",
      screenId: "screen-1",
      slideIndex: 0,
      slideCount: 1,
      reference: "Praise",
      segments: [{ text: "Praise to the Lord" }],
    }

    expect(deckToSongDoc("Copied", [slide])).toEqual({
      title: "Copied",
      sections: [{ kind: "verse", index: 1, lines: ["Praise to the Lord"] }],
    })
  })
})
