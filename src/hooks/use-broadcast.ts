import type { VerseRenderData } from "@/types"
import type { Verse } from "@/types"
import { splitTextForReadableSlides } from "@/lib/text-slide-chunking"

export function toVerseRenderData(verse: Verse, translation: string): VerseRenderData {
  return {
    reference: `${verse.book_name} ${verse.chapter}:${verse.verse} (${translation})`,
    segments: splitTextForReadableSlides(verse.text, {
      maxChars: 150,
      softChars: 120,
    }).map((text, index) => ({
      verseNumber: index === 0 ? verse.verse : undefined,
      text,
    })),
  }
}
