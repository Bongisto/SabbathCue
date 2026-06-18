import { open } from "@tauri-apps/plugin-dialog"
import { FileImageIcon, FileUpIcon, MusicIcon, PaletteIcon, PlusIcon, Rows3Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { readImageThumbnail, saveLibraryImage } from "@/lib/library/library-image"
import { deckToSongDoc } from "@/lib/library/song-doc"
import { downscaleImageToThumbnail } from "@/lib/library/thumbnail"
import { importPowerPointSlides, POWERPOINT_EXTENSIONS } from "@/lib/powerpoint-import"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import type { LibraryAsset } from "@/types/library"
import type { SlideDeckPresentationItemData } from "@/types"

interface AddAssetMenuProps {
  onCreateSong: () => void
}

export function AddAssetMenu({ onCreateSong }: AddAssetMenuProps) {
  const addAsset = useLibraryStore((state) => state.addAsset)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const hymnDeck = useHymnSlideStore((state) => state.deck)

  const importImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
        },
      ],
    })
    if (typeof selected !== "string") return

    const [saved, dataUrl] = await Promise.all([
      saveLibraryImage(selected),
      readImageThumbnail(selected),
    ])
    const thumbnail = await downscaleImageToThumbnail(dataUrl)
    addAsset({
      id: crypto.randomUUID(),
      name: saved.fileName.replace(/\.[^.]+$/, ""),
      type: "image",
      collectionIds: [],
      fileName: saved.fileName,
      width: saved.width,
      height: saved.height,
      mimeType: saved.mimeType,
      thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const saveTheme = () => {
    if (!activeTheme) return
    addAsset({
      id: crypto.randomUUID(),
      name: activeTheme.name,
      type: "theme",
      collectionIds: [],
      theme: { ...activeTheme, builtin: false },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const saveCurrentDeck = () => {
    if (hymnDeck.length === 0) return
    addAsset({
      id: crypto.randomUUID(),
      name: hymnDeck[0]?.hymnTitle ?? "Song Deck",
      type: "song",
      collectionIds: [],
      song: deckToSongDoc(hymnDeck[0]?.hymnTitle ?? "Song Deck", hymnDeck),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const importPowerPoint = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PowerPoint", extensions: POWERPOINT_EXTENSIONS }],
    })
    if (typeof selected !== "string") return
    const slides = await importPowerPointSlides(selected)
    addAsset(createSlideTemplateAsset(slides))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm">
          <PlusIcon className="size-3.5" />
          Add Asset
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => void importImage()}>
          <FileImageIcon className="size-4" />
          Import image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={saveTheme} disabled={!activeTheme}>
          <PaletteIcon className="size-4" />
          Save current theme
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateSong}>
          <MusicIcon className="size-4" />
          New song
        </DropdownMenuItem>
        <DropdownMenuItem onClick={saveCurrentDeck} disabled={hymnDeck.length === 0}>
          <Rows3Icon className="size-4" />
          Save current deck
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void importPowerPoint()}>
          <FileUpIcon className="size-4" />
          Import PowerPoint
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function createSlideTemplateAsset(
  slides: Array<{ index: number; dataUrl: string; label: string }>,
): LibraryAsset {
  const id = crypto.randomUUID()
  const deck: SlideDeckPresentationItemData[] = slides.map((slide) => ({
    kind: "slideDeck",
    deckId: id,
    deckTitle: "Imported PowerPoint",
    slideId: `${id}-${slide.index}`,
    slideIndex: slide.index,
    slideCount: slides.length,
    slidePath: slide.dataUrl,
    reference: slide.label,
    segments: [{ text: slide.label }],
  }))
  return {
    id,
    name: "Imported PowerPoint",
    type: "slide-template",
    collectionIds: [],
    thumbnail: slides[0]?.dataUrl,
    deck,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
