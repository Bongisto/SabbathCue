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

  it("splits blank-line and CRLF stanzas without requiring triple newlines (FU-09)", () => {
    const lf = parseSongText(
      "Grace",
      "Verse 1 line 1\nVerse 1 line 2\n\nVerse 2 line 1\nVerse 2 line 2",
    )
    expect(lf.sections).toHaveLength(2)
    expect(lf.sections[0]?.lines).toEqual(["Verse 1 line 1", "Verse 1 line 2"])
    expect(lf.sections[1]?.lines).toEqual(["Verse 2 line 1", "Verse 2 line 2"])

    const crlf = parseSongText(
      "Grace",
      "Verse 1 line 1\r\nVerse 1 line 2\r\n\r\nVerse 2 line 1\r\n---\r\nVerse 3 line 1",
    )
    expect(crlf.sections).toHaveLength(3)
    expect(crlf.sections.map((s) => s.lines)).toEqual([
      ["Verse 1 line 1", "Verse 1 line 2"],
      ["Verse 2 line 1"],
      ["Verse 3 line 1"],
    ])
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
