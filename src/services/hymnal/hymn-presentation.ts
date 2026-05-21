import type { Hymn, HymnScreen, QueueItem } from "@/types"
import type { HymnPresentationItemData } from "@/types"

export function createHymnPresentationItem(screen: HymnScreen): HymnPresentationItemData {
  const label =
    screen.sectionScreenCount > 1
      ? `${screen.sectionLabel} ${screen.sectionScreenIndex + 1}/${screen.sectionScreenCount}`
      : screen.sectionLabel

  return {
    kind: "hymn",
    hymnId: screen.hymnId,
    hymnNumber: screen.hymnNumber,
    hymnTitle: screen.hymnTitle,
    screenId: screen.id,
    reference: `#${screen.hymnNumber} ${screen.hymnTitle} - ${label}`,
    segments: screen.lines.map((text) => ({ text })),
  }
}

export function createHymnQueueItem(screen: HymnScreen): QueueItem {
  return {
    id: `hymn-${screen.hymnNumber}-${screen.id}-${crypto.randomUUID()}`,
    presentation: createHymnPresentationItem(screen),
    confidence: 1,
    source: "hymn",
    added_at: Date.now(),
  }
}

export function defaultSelectedSectionIds(hymn: Hymn): string[] {
  return hymn.sections.map((section) => section.id)
}
