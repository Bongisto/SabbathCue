import { useMemo } from "react"
import { useSortable } from "@dnd-kit/react/sortable"
import {
  EyeIcon,
  GripVerticalIcon,
  PlayIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import { cn } from "@/lib/utils"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useQueueStore } from "@/stores/queue-store"
import {
  getPresentationRenderData,
  getReferenceFromItem,
  getVerseFromItem,
  type PresentationItem,
  type PresentationRenderData,
  type QueueItem,
} from "@/types"

function scriptureMatchesQueueItem(
  renderData: PresentationRenderData,
  queueItem: QueueItem
): boolean {
  if (renderData.kind !== "scripture") return false
  const verse = getVerseFromItem(queueItem)
  const liveVerse = renderData.scripture
  if (!verse || !liveVerse) return false
  return (
    liveVerse.book_number === verse.book_number &&
    liveVerse.chapter === verse.chapter &&
    liveVerse.verse === verse.verse
  )
}

function hymnMatchesQueueItem(
  renderData: PresentationRenderData,
  queueItem: QueueItem
): boolean {
  if (renderData.kind !== "hymn" || queueItem.presentation.kind !== "hymn") {
    return false
  }
  const screenId = renderData.hymnSlide?.screenId
  if (queueItem.hymnDeck?.length) {
    return Boolean(
      screenId && queueItem.hymnDeck.some((s) => s.screenId === screenId)
    )
  }
  if (screenId && queueItem.presentation.screenId === screenId) return true
  return Boolean(
    renderData.hymnTitle &&
      renderData.hymnTitle === queueItem.presentation.hymnTitle
  )
}

function slideDeckMatchesQueueItem(
  renderData: PresentationRenderData,
  queueItem: QueueItem
): boolean {
  if (
    renderData.kind !== "slideDeck" ||
    queueItem.presentation.kind !== "slideDeck"
  ) {
    return false
  }
  const slideId = renderData.hymnSlide?.screenId
  if (queueItem.slideDeck?.length) {
    return Boolean(
      slideId && queueItem.slideDeck.some((s) => s.slideId === slideId)
    )
  }
  return Boolean(slideId && queueItem.presentation.slideId === slideId)
}

function renderItemMatchesQueueItem(
  renderData: PresentationRenderData | null,
  queueItem: QueueItem
): boolean {
  if (!renderData) return false
  const presentation = queueItem.presentation

  switch (presentation.kind) {
    case "scripture":
      return scriptureMatchesQueueItem(renderData, queueItem)
    case "hymn":
      return hymnMatchesQueueItem(renderData, queueItem)
    case "slideDeck":
      return slideDeckMatchesQueueItem(renderData, queueItem)
    case "egw":
      return (
        renderData.kind === "egw" &&
        renderData.egwParagraph?.id === presentation.paragraph.id
      )
    case "video":
      return (
        renderData.kind === "video" &&
        renderData.video?.videoId === presentation.videoId
      )
    case "media":
      return (
        renderData.kind === "media" &&
        renderData.reference === presentation.reference
      )
  }
}

export function kindLabel(kind: PresentationItem["kind"]): string {
  if (kind === "slideDeck") return "Slide"
  if (kind === "egw") return "Ellen White"
  return kind
}

export function slideLabel(item: PresentationItem): string | null {
  if (item.kind === "hymn" || item.kind === "slideDeck" || item.kind === "egw") {
    return `Slide ${item.slideIndex + 1}/${item.slideCount}`
  }
  return null
}

export function sourceLabel(source: QueueItem["source"]): string {
  if (source === "service-plan") return "Plan"
  if (source === "ai-direct") return "Direct"
  if (source === "ai-semantic") return "Semantic"
  if (source === "ai-cloud") return "Cloud"
  return source
}

export function PresentationThumbnail({
  renderData,
  className,
}: {
  renderData: PresentationRenderData | null
  className?: string
}) {
  const activeTheme = useBroadcastStore(selectActiveTheme)

  if (renderData?.kind === "video") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden bg-black",
          className
        )}
      >
        {renderData.video?.poster ? (
          <img
            src={renderData.video.poster}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <VideoIcon className="size-8 text-muted-foreground" />
        )}
      </div>
    )
  }

  if (renderData?.kind === "slideDeck" && renderData.slideImageUrl) {
    return (
      <img
        src={renderData.slideImageUrl}
        alt=""
        className={cn("h-full w-full object-contain", className)}
        loading="lazy"
      />
    )
  }

  if (activeTheme && renderData) {
    return (
      <CanvasPresentation
        theme={activeTheme}
        item={renderData}
        className={cn("[&_canvas]:rounded-sm", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center text-xs text-muted-foreground",
        className
      )}
    >
      Preview
    </div>
  )
}

export function QueueSorterCard({
  item,
  index,
  isActive,
  isSelected,
  onSelectClick,
}: {
  item: QueueItem
  index: number
  isActive: boolean
  isSelected: boolean
  onSelectClick: (id: string, mods: { ctrl: boolean; shift: boolean }) => void
}) {
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index })
  const isLive = useBroadcastLiveStore((s) => s.isLive)
  const liveQueueItemId = useBroadcastLiveStore((s) => s.liveQueueItemId)
  const liveItem = useBroadcastLiveStore((s) => s.liveItem)
  const previewItem = useBroadcastLiveStore((s) => s.previewItem)

  const renderData = useMemo(
    () => getPresentationRenderData(item.presentation),
    [item.presentation]
  )
  const label = slideLabel(item.presentation)
  const reference = getReferenceFromItem(item)
  const orderLabel = String(index + 1).padStart(2, "0")
  const isCardLive =
    isLive &&
    (liveQueueItemId === item.id ||
      (liveQueueItemId === null &&
        isActive &&
        renderItemMatchesQueueItem(liveItem, item)))
  const isCardPreview =
    !isCardLive && isActive && renderItemMatchesQueueItem(previewItem, item)
  const statusBadge = isCardLive
    ? "Live"
    : isCardPreview
      ? "Preview"
      : isActive
        ? "Selected"
        : null

  const preview = () => {
    useQueueStore.getState().setActive(index)
    previewQueuedItem(item)
  }
  const present = () => {
    useQueueStore.getState().setActive(index)
    presentQueuedItem(item)
  }

  return (
    <article
      ref={ref}
      data-testid={`queue-card-${item.id}`}
      onClick={(event) =>
        onSelectClick(item.id, {
          ctrl: event.ctrlKey || event.metaKey,
          shift: event.shiftKey,
        })
      }
      onDoubleClick={present}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-2 transition-shadow",
        "hover:shadow-md focus-visible:outline-none",
        isSelected && "ring-2 ring-[var(--accent)]",
        isActive && "bg-[var(--accent-glow)]",
        isDragging && "opacity-60"
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
        <PresentationThumbnail renderData={renderData} />

        <div className="absolute left-1 top-1 flex items-center gap-1">
          <Button
            ref={handleRef}
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={`Drag ${reference}`}
            title="Drag to reorder"
            className="size-5 cursor-grab rounded-md active:cursor-grabbing"
            onClick={(event) => event.stopPropagation()}
          >
            <GripVerticalIcon className="size-3" />
          </Button>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className="min-w-6 justify-center px-1.5 text-xs font-bold tabular-nums"
          >
            {orderLabel}
          </Badge>
        </div>

        {statusBadge ? (
          <Badge
            variant={isCardLive ? "default" : "secondary"}
            className="absolute right-1 top-1 px-1.5 text-[10px] font-bold tracking-wide uppercase"
          >
            {statusBadge}
          </Badge>
        ) : null}

        <div
          className="absolute inset-x-1 bottom-1 flex justify-end gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            draggable={false}
            aria-label={`Preview ${reference}`}
            title="Preview"
            onClick={(event) => {
              event.stopPropagation()
              preview()
            }}
          >
            <EyeIcon className="size-3" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            draggable={false}
            aria-label={`Go live ${reference}`}
            title="Go live"
            onClick={(event) => {
              event.stopPropagation()
              present()
            }}
          >
            <PlayIcon className="size-3" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            draggable={false}
            aria-label={`Remove ${reference}`}
            title="Remove"
            onClick={(event) => {
              event.stopPropagation()
              useQueueStore.getState().removeItem(item.id)
            }}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline">{kindLabel(item.presentation.kind)}</Badge>
          <Badge variant="outline">{sourceLabel(item.source)}</Badge>
          {label ? <Badge variant="outline">{label}</Badge> : null}
        </div>
        <p className="truncate text-sm font-semibold text-foreground">
          {reference}
        </p>
      </div>
    </article>
  )
}
