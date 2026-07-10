import { splitTextForReadableSlides } from "@/lib/text-slide-chunking"
import type { EgwParagraph, EgwPresentationItemData } from "@/types"

export function egwReference(p: EgwParagraph): string {
  return `${p.book_title} p.${p.page} par.${p.page_paragraph}`
}

function splitEgwTextForSlides(text: string): { text: string }[] {
  return splitTextForReadableSlides(text, {
    maxChars: 150,
    softChars: 125,
  }).map((chunk) => ({ text: chunk }))
}

export function createEgwDeckItems(p: EgwParagraph): EgwPresentationItemData[] {
  const segments = splitEgwTextForSlides(p.text)
  const baseReference = egwReference(p)

  return segments.map((segment, index) => ({
    kind: "egw" as const,
    paragraph: p,
    reference:
      segments.length > 1
        ? `${baseReference} (${index + 1}/${segments.length})`
        : baseReference,
    segments: [segment],
    slideId: `egw-${p.id}-${index}`,
    slideIndex: index,
    slideCount: segments.length,
  }))
}

export function createEgwPresentationItem(
  p: EgwParagraph
): EgwPresentationItemData {
  return createEgwDeckItems(p)[0]!
}
