import type { BroadcastTheme, VerseRenderData, PresentationRenderData } from "@/types"

export function getBroadcastRenderKey(
  theme: BroadcastTheme,
  data: VerseRenderData | PresentationRenderData | null,
): string {
  return JSON.stringify({
    theme: {
      id: theme.id,
      updatedAt: theme.updatedAt,
      resolution: theme.resolution,
      background: theme.background,
      textBox: theme.textBox,
      verseText: theme.verseText,
      verseNumbers: theme.verseNumbers,
      reference: theme.reference,
      layout: theme.layout,
    },
    data,
  })
}
