import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { Input } from "@/components/ui/input"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { bibleActions } from "@/hooks/use-bible"
import {
  commitPreviewToLive,
  selectPreviewItem,
  selectPreviewVerse,
} from "@/lib/presentation-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { PresentationDeckControls } from "@/components/panels/presentation-deck-controls"
import {
  presentationDeckKind,
  type PresentationDeckKind,
} from "@/lib/presentation-deck-navigation"
import {
  advancePresentationTarget,
  isPresentationNavigationEditableTarget,
} from "@/lib/presentation-panel-navigation"
import {
  getAutocompleteSuggestion,
  getTabNavigationResult,
  type Book as QuickSearchBook,
} from "@/lib/quick-search"
import {
  isPresentableLibraryAsset,
  previewLibraryAsset,
} from "@/lib/library/library-presentation"
import { searchHymns } from "@/services/hymnal/hymnal-repository"
import { loadHymnVoiceControl } from "@/services/hymnal/hymn-voice-control-loader"
import type { PresentationRenderData } from "@/types"
import {
  BookOpenIcon,
  LibraryIcon,
  MonitorIcon,
  Music2Icon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { convertTauriFileSrc } from "@/lib/tauri-runtime"
import type { LibraryAsset } from "@/types/library"

const QUICK_PREVIEW_DEBOUNCE_MS = 120

function quickContentQuery(value: string): string {
  return value
    .replace(/^(?:hymn|song)\s+(?:number\s+)?/i, "")
    .trim()
}

function librarySearchText(asset: LibraryAsset): string {
  return [asset.name, asset.type, ...(asset.tags ?? [])].join(" ").toLowerCase()
}

function quickAssetLabel(asset: LibraryAsset): string {
  if (asset.type === "slide-template") return "Slides"
  return asset.type.charAt(0).toUpperCase() + asset.type.slice(1)
}

function previewVideoSrc(item: PresentationRenderData): string | null {
  const video = item.video
  if (!video) return null
  if (video.source === "local" && video.videoPath) return convertTauriFileSrc(video.videoPath)
  if (video.source === "url" && video.url) return video.url
  if (video.source === "youtube" && video.youtubeId) {
    return `https://www.youtube-nocookie.com/embed/${video.youtubeId}?controls=1`
  }
  return null
}

function PreviewQuickSearch() {
  const books = useBibleStore((s) => s.books)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const assets = useLibraryStore((s) => s.assets)
  const [query, setQuery] = useState("")
  const [feedback, setFeedback] = useState("")
  const requestIdRef = useRef(0)

  const trimmedQuery = query.trim()
  const bibleResult = useMemo(
    () => getAutocompleteSuggestion(query, books as QuickSearchBook[]),
    [books, query]
  )
  const hymnQuery = useMemo(() => quickContentQuery(query), [query])
  const hymnMatches = useMemo(
    () => (hymnQuery ? searchHymns(hymnQuery, 3) : []),
    [hymnQuery]
  )
  const libraryMatches = useMemo(() => {
    const q = (hymnQuery || trimmedQuery).toLowerCase()
    if (!q) return []
    return assets
      .filter(isPresentableLibraryAsset)
      .filter((asset) => librarySearchText(asset).includes(q))
      .slice(0, 3)
  }, [assets, hymnQuery, trimmedQuery])

  useEffect(() => {
    if (books.length > 0) return
    void bibleActions.loadBooks(activeTranslationId)
  }, [activeTranslationId, books.length])

  const previewVerseReference = useCallback(
    async (bookNumber: number, chapter: number, verse: number) => {
      const requestId = ++requestIdRef.current
      setFeedback("Previewing verse...")
      const result = await bibleActions.fetchVerse(
        bookNumber,
        chapter,
        verse,
        activeTranslationId
      )
      if (requestId !== requestIdRef.current) return
      if (!result) {
        setFeedback("Verse not found")
        return
      }
      selectPreviewVerse(result)
      setFeedback(`Previewed ${result.book_name} ${result.chapter}:${result.verse}`)
    },
    [activeTranslationId]
  )

  useEffect(() => {
    if (
      bibleResult.stage !== "complete" ||
      !bibleResult.matchedBook ||
      !bibleResult.chapter ||
      !bibleResult.verse
    ) {
      return
    }

    const timer = setTimeout(() => {
      void previewVerseReference(
        bibleResult.matchedBook!.book_number,
        bibleResult.chapter!,
        bibleResult.verse!
      )
    }, QUICK_PREVIEW_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    bibleResult.chapter,
    bibleResult.matchedBook,
    bibleResult.stage,
    bibleResult.verse,
    previewVerseReference,
  ])

  const previewHymn = useCallback(async (number: number) => {
    setFeedback(`Previewing hymn ${number}...`)
    const mod = await loadHymnVoiceControl()
    await mod.previewHymnByNumber(number)
    setQuery("")
    setFeedback("")
  }, [])

  const previewAsset = useCallback((asset: LibraryAsset) => {
    previewLibraryAsset(asset)
    setQuery("")
    setFeedback("")
  }, [])

  const previewFirstMatch = useCallback(() => {
    if (
      bibleResult.stage === "complete" &&
      bibleResult.matchedBook &&
      bibleResult.chapter &&
      bibleResult.verse
    ) {
      void previewVerseReference(
        bibleResult.matchedBook.book_number,
        bibleResult.chapter,
        bibleResult.verse
      )
      return
    }
    const hymn = hymnMatches[0]
    if (hymn) {
      void previewHymn(hymn.number)
      return
    }
    const asset = libraryMatches[0]
    if (asset) previewAsset(asset)
  }, [
    bibleResult.chapter,
    bibleResult.matchedBook,
    bibleResult.stage,
    bibleResult.verse,
    hymnMatches,
    libraryMatches,
    previewAsset,
    previewHymn,
    previewVerseReference,
  ])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      (event.key === "Tab" || event.key === "ArrowRight") &&
      bibleResult.suggestion &&
      bibleResult.suggestion !== query
    ) {
      event.preventDefault()
      setQuery(getTabNavigationResult(query, bibleResult.suggestion))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      previewFirstMatch()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setQuery("")
      setFeedback("")
    }
  }

  const showDropdown =
    trimmedQuery.length > 0 &&
    (bibleResult.stage === "complete" ||
      hymnMatches.length > 0 ||
      libraryMatches.length > 0 ||
      Boolean(feedback))

  return (
    <div className="relative w-full min-w-[13rem] sm:w-72 xl:w-80">
      {bibleResult.suggestion && bibleResult.suggestion !== query ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-8">
          <span className="truncate text-xs">
            <span className="text-foreground">{query}</span>
            <span className="text-muted-foreground">
              {bibleResult.suggestion.slice(query.length)}
            </span>
          </span>
        </div>
      ) : null}
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-20 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setFeedback("")
        }}
        onKeyDown={handleKeyDown}
        placeholder="Quick preview: John 3:16, hymn 46"
        className={cn(
          "h-8 rounded-md border-[var(--border-subtle)] bg-[var(--shell-code-bg)] pr-2 pl-8 text-xs",
          bibleResult.suggestion && bibleResult.suggestion !== query
            ? "text-transparent"
            : ""
        )}
        style={
          bibleResult.suggestion && bibleResult.suggestion !== query
            ? { caretColor: "var(--foreground)" }
            : undefined
        }
      />

      {showDropdown ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[rgba(2,3,7,0.95)] shadow-lg backdrop-blur-md">
          {bibleResult.stage === "complete" &&
          bibleResult.matchedBook &&
          bibleResult.chapter &&
          bibleResult.verse ? (
            <button
              type="button"
              onClick={() =>
                void previewVerseReference(
                  bibleResult.matchedBook!.book_number,
                  bibleResult.chapter!,
                  bibleResult.verse!
                )
              }
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpenIcon className="size-3.5 text-lime-400" />
              <span className="min-w-0 flex-1 truncate">
                Preview {bibleResult.matchedBook.name} {bibleResult.chapter}:
                {bibleResult.verse}
              </span>
            </button>
          ) : null}
          {hymnMatches.map((hymn) => (
            <button
              key={hymn.id}
              type="button"
              onClick={() => void previewHymn(hymn.number)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Music2Icon className="size-3.5 text-amber-300" />
              <span className="min-w-0 flex-1 truncate">
                #{hymn.number} {hymn.title}
              </span>
            </button>
          ))}
          {libraryMatches.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => previewAsset(asset)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <LibraryIcon className="size-3.5 text-sky-300" />
              <span className="min-w-0 flex-1 truncate">{asset.name}</span>
              <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                {quickAssetLabel(asset)}
              </span>
            </button>
          ))}
          {feedback ? (
            <div className="border-t border-[var(--border-subtle)] px-2 py-1 text-[0.625rem] text-muted-foreground">
              {feedback}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function PreviewPanel({ className }: { className?: string }) {
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const activeTheme = useBroadcastStore(selectActiveTheme)
  const isLive = useBroadcastStore((s) => s.isLive)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)

  useEffect(() => {
    let cancelled = false
    if (useBroadcastStore.getState().previewItem?.kind !== "scripture") return
    const verse = useBibleStore.getState().selectedVerse
    if (verse && verse.book_number > 0 && verse.chapter > 0 && verse.verse > 0) {
      bibleActions
        .fetchVerse(verse.book_number, verse.chapter, verse.verse)
        .then((v) => {
          if (!cancelled && v) selectPreviewVerse(v)
        })
        .catch((e) => console.error("[preview] verse refetch on translation change failed", e))
    }
    return () => {
      cancelled = true
    }
  }, [activeTranslationId])

  const clearPreviewBlocked = isLive && readingModeAutoLive

  const clearPreview = () => {
    if (clearPreviewBlocked) return
    useBroadcastStore.getState().setPreviewItem(null)
    useBibleStore.getState().selectVerse(null)
  }

  const navigatePreviewDeck = (kind: PresentationDeckKind, index: number) => {
    if (kind === "hymn") {
      const hymnSlides = useHymnSlideStore.getState()
      const next = hymnSlides.deck[index]
      if (!next) return
      hymnSlides.setDeck(hymnSlides.deck, index)
      selectPreviewItem(next)
      return
    }
    if (kind === "egw") {
      const egwSlides = useEgwSlideStore.getState()
      const next = egwSlides.deck[index]
      if (!next) return
      egwSlides.setDeck(egwSlides.deck, index)
      selectPreviewItem(next)
      return
    }
    const sermonSlides = useSermonSlideStore.getState()
    const next = sermonSlides.deck[index]
    if (!next) return
    sermonSlides.setDeck(sermonSlides.deck, index, sermonSlides.activeItemId)
    selectPreviewItem(next)
  }

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      isPresentationNavigationEditableTarget(event.target)
    ) {
      return
    }

    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (delta === 0) return

    if (
      advancePresentationTarget(
        delta,
        useBroadcastStore.getState().previewItem,
        false
      )
    ) {
      event.preventDefault()
    }
  }

  return (
    <div
      data-slot="preview-panel"
      tabIndex={0}
      onKeyDown={handlePanelKeyDown}
      className={cn(
        "glass-panel relative flex min-h-0 flex-col overflow-hidden outline-none",
        className,
      )}
    >
      <PanelHeader title="Program preview" icon={<MonitorIcon className="size-3" />} step={2}>
        <Badge variant="outline" className="h-5 text-[0.5625rem] uppercase">
          Staged
        </Badge>
      </PanelHeader>

      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {previewItem?.reference ?? "No item selected"}
          </p>
          <p className="text-xs text-muted-foreground">
            Preview only. Verses, hymns, and songs change audience output when sent live.
          </p>
        </div>

        <PreviewQuickSearch />

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {presentationDeckKind(previewItem) ? (
            <PresentationDeckControls
              item={previewItem}
              onNavigate={navigatePreviewDeck}
            />
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={!previewItem || clearPreviewBlocked}
            className="gap-2"
            onClick={clearPreview}
            title={
              clearPreviewBlocked
                ? "Turn off Auto-live reading mode or hide Live Output before clearing preview"
                : "Clear preview"
            }
          >
            <XIcon className="size-3.5" />
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!previewItem}
            className="gap-2"
            onClick={() => commitPreviewToLive()}
          >
            <SendIcon className="size-3.5" />
            Send Live
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {previewItem?.kind === "video" && previewVideoSrc(previewItem) ? (
          previewItem.video?.source === "youtube" ? (
            <iframe
              title={previewItem.reference}
              src={previewVideoSrc(previewItem) ?? undefined}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="aspect-video max-h-full w-full rounded-md border border-[var(--border-subtle)] bg-black"
            />
          ) : (
            <video
              src={previewVideoSrc(previewItem) ?? undefined}
              poster={previewItem.video?.poster}
              controls
              className="aspect-video max-h-full w-full rounded-md border border-[var(--border-subtle)] bg-black object-contain"
            />
          )
        ) : previewItem && activeTheme ? (
          <CanvasPresentation theme={activeTheme} item={previewItem} />
        ) : (
          <PanelEmptyState
            icon={<MonitorIcon className="size-8" />}
            title="No item selected"
            description="Detected verses, searched passages, hymns, and song slides appear here before going live."
          />
        )}
      </div>
    </div>
  )
}
