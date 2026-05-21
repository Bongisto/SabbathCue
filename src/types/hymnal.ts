export type HymnSectionKind = "verse" | "refrain"

export interface HymnSection {
  id: string
  kind: HymnSectionKind
  label: string
  number?: number
  afterVerseNumber?: number
  lines: string[]
}

export interface Hymn {
  id: string
  number: number
  title: string
  firstLine?: string | null
  category?: string | null
  sections: HymnSection[]
}

export interface HymnSearchResult {
  id: string
  number: number
  title: string
  firstLine?: string | null
  category?: string | null
}

export interface HymnScreen {
  id: string
  hymnId: string
  hymnNumber: number
  hymnTitle: string
  sectionId: string
  sectionLabel: string
  sectionKind: HymnSectionKind
  screenIndex: number
  sectionScreenIndex: number
  sectionScreenCount: number
  totalScreens: number
  lines: string[]
}
