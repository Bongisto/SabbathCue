import type { PresentationRenderData } from "@/types"
import type { Verse } from "@/types"
import { splitTextForReadableSlides } from "@/lib/text-slide-chunking"

export function toVerseRenderData(
  verse: Verse,
  translation: string
): PresentationRenderData {
  return {
    kind: "scripture",
    reference: `${verse.book_name} ${verse.chapter}:${verse.verse} (${translation})`,
    scripture: verse,
    segments: splitTextForReadableSlides(verse.text, {
      maxChars: 150,
      softChars: 120,
    }).map((text, index) => ({
      verseNumber: index === 0 ? verse.verse : undefined,
      text,
    })),
  }
}
