import { splitLyricLineForReadableSlides } from "@/lib/text-slide-chunking"
import type { SongDeck, SongDoc } from "@/types/library"
import type { HymnPresentationItemData } from "@/types"

function sectionLabel(section: SongDoc["sections"][number]): string {
  const base = section.kind[0].toUpperCase() + section.kind.slice(1)
  return section.index ? `${base} ${section.index}` : base
}

export function songDocToDeck(song: SongDoc): SongDeck {
  const title = song.title.trim() || "Custom Song"
  const slideLines = song.sections.flatMap((section) => {
    const lines = section.lines.flatMap((line) =>
      splitLyricLineForReadableSlides(line),
    )
    const slides: Array<{ label: string; lines: string[] }> = []
    for (let index = 0; index < lines.length; index += 3) {
      slides.push({
        label: sectionLabel(section),
        lines: lines.slice(index, index + 3),
      })
    }
    return slides
  })

  return slideLines.map((slide, index) => ({
    kind: "hymn",
    hymnId: `library-song-${slugify(title)}`,
    hymnNumber: 0,
    hymnTitle: title,
    screenId: `library-song-${slugify(title)}-${index}`,
    slideIndex: index,
    slideCount: slideLines.length,
    reference: `${title} - ${slide.label} ${index + 1}/${slideLines.length}`,
    segments: slide.lines.map((text) => ({ text })),
  }))
}

export function deckToSongDoc(
  title: string,
  deck: HymnPresentationItemData[],
): SongDoc {
  return {
    title: title.trim() || deck[0]?.hymnTitle || "Custom Song",
    sections: deck.map((slide, index) => ({
      kind: "verse",
      index: index + 1,
      lines: slide.segments.map((segment) => segment.text),
    })),
  }
}

export function parseSongText(title: string, text: string): SongDoc {
  const blocks = text
    .split(/\n\s*(?:---+|\n)\s*\n/g)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)

  return {
    title: title.trim() || "Custom Song",
    sections: blocks.map((lines, index) => ({
      kind: index === 0 ? "verse" : "chorus",
      index: index + 1,
      lines,
    })),
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
