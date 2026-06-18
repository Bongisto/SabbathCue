import type { BroadcastTheme, HymnPresentationItemData, SlideDeckPresentationItemData } from "@/types"

export type LibraryAssetType = "theme" | "image" | "song" | "slide-template"

export type SongSectionKind = "verse" | "chorus" | "bridge"

export interface SongDoc {
  title: string
  sections: Array<{
    kind: SongSectionKind
    index?: number
    lines: string[]
  }>
}

export interface LibraryCollection {
  id: string
  name: string
  assetIds: string[]
  coverAssetId?: string
  createdAt: number
  updatedAt: number
}

interface LibraryAssetBase {
  id: string
  name: string
  type: LibraryAssetType
  collectionIds: string[]
  tags?: string[]
  thumbnail?: string
  createdAt: number
  updatedAt: number
}

export interface LibraryThemeAsset extends LibraryAssetBase {
  type: "theme"
  theme: BroadcastTheme
}

export interface LibraryImageAsset extends LibraryAssetBase {
  type: "image"
  fileName: string
  width: number
  height: number
  mimeType: string
}

export interface LibrarySongAsset extends LibraryAssetBase {
  type: "song"
  song: SongDoc
}

export interface LibrarySlideTemplateAsset extends LibraryAssetBase {
  type: "slide-template"
  deck: SlideDeckPresentationItemData[]
}

export type LibraryAsset =
  | LibraryThemeAsset
  | LibraryImageAsset
  | LibrarySongAsset
  | LibrarySlideTemplateAsset

export type LibraryPreviewAsset =
  | LibraryImageAsset
  | LibrarySongAsset
  | LibrarySlideTemplateAsset
  | LibraryThemeAsset

export type SongDeck = HymnPresentationItemData[]
