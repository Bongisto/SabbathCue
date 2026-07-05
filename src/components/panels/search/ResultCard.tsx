import type { Ref } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckIcon, EyeIcon, PlayIcon, PlusIcon } from "lucide-react"

export type ResultBadgeTone = "scripture" | "egw"

function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2)
  )
  if (queryWords.size === 0) return <>{text}</>

  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, index) => {
        const cleaned = part.toLowerCase().replace(/[^a-z']/g, "")
        if (cleaned.length >= 2 && queryWords.has(cleaned)) {
          return (
            <mark
              key={index}
              className="rounded-[2px] bg-emerald-800/90 px-0.5 text-foreground"
            >
              {part}
            </mark>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

/**
 * Operator result card shared by Bible book browsing, semantic context search, and
 * the EGW browser. Reference on top, translation/source badge, the text body, and
 * explicit Preview / Live / Queue actions. The whole card previews on click; the
 * action buttons stop propagation so they fire their own intent.
 */
export function ResultCard({
  domId,
  cardRef,
  reference,
  text,
  badgeLabel,
  badgeTone = "scripture",
  similarity,
  highlightQuery,
  selected = false,
  queued = false,
  onPreview,
  onLive,
  onQueue,
  onQueuedClick,
}: {
  domId?: string
  cardRef?: Ref<HTMLDivElement>
  reference: string
  text: string
  badgeLabel: string
  badgeTone?: ResultBadgeTone
  similarity?: number
  highlightQuery?: string
  selected?: boolean
  queued?: boolean
  onPreview: () => void
  onLive: () => void
  onQueue: () => void
  onQueuedClick?: () => void
}) {
  return (
    <div
      id={domId}
      ref={cardRef}
      onClick={onPreview}
      className={cn(
        "group flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
        selected
          ? "border-lime-500/50 bg-lime-500/10"
          : "border-[var(--border-subtle)] hover:bg-[var(--shell-bg-sunken)]"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{reference}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider uppercase",
            badgeTone === "egw"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-lime-500/15 text-lime-700 dark:text-lime-300"
          )}
        >
          {badgeLabel}
        </span>
        {typeof similarity === "number" ? (
          <span className="ml-auto text-[0.625rem] font-medium text-muted-foreground">
            {Math.round(similarity * 100)}%
          </span>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">
        <HighlightedText text={text} query={highlightQuery} />
      </p>

      <div className="mt-1 flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          title="Preview"
          aria-label="Preview"
          onClick={(e) => {
            e.stopPropagation()
            onPreview()
          }}
        >
          <EyeIcon className="size-3" />
        </Button>
        <Button
          size="icon-xs"
          title="Send live"
          aria-label="Send live"
          onClick={(e) => {
            e.stopPropagation()
            onLive()
          }}
        >
          <PlayIcon className="size-3" />
        </Button>
        {queued ? (
          <Button
            variant="ghost"
            size="icon-xs"
            title="Already in queue"
            aria-label="Already in queue"
            onClick={(e) => {
              e.stopPropagation()
              onQueuedClick?.()
            }}
          >
            <CheckIcon className="size-3 text-ai-direct" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            title="Add to queue"
            aria-label="Add to queue"
            onClick={(e) => {
              e.stopPropagation()
              onQueue()
            }}
          >
            <PlusIcon className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
