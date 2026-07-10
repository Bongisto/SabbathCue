import { useMemo } from "react"
import { useSortable } from "@dnd-kit/react/sortable"
import { EyeIcon, PlayIcon, Trash2Icon, VideoIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasPresentation } from "@/components/ui/canvas-verse"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import { cn } from "@/lib/utils"
import { selectActiveTheme, useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import {
  getPresentationRenderData,
  getReferenceFromItem,
  type PresentationItem,
  type PresentationRenderData,
  type QueueItem,
} from "@/types"

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
  const { ref, isDragging } = useSortable({ id: item.id, index })

  const renderData = useMemo(
    () => getPresentationRenderData(item.presentation),
    [item.presentation]
  )
  const label = slideLabel(item.presentation)

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

        <Badge
          variant={isActive ? "default" : "secondary"}
          className="absolute left-1 top-1 min-w-6 justify-center px-1.5 text-xs font-bold tabular-nums"
        >
          {String(index + 1).padStart(2, "0")}
        </Badge>

        {isActive ? (
          <Badge
            variant="default"
            className="absolute right-1 top-1 px-1.5 text-[10px] font-bold tracking-wide uppercase"
          >
            Live
          </Badge>
        ) : null}

        <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
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
          {getReferenceFromItem(item)}
        </p>
      </div>
    </article>
  )
}
