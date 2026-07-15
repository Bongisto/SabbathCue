import { EyeIcon, PlayIcon, PlusIcon, RadarIcon, XIcon } from "lucide-react"
import { getDetectionActions, SourceBadge } from "./detections-panel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCollectedDetectionsStore } from "@/stores/collected-detections-store"

export function CollectedDetectionsPanel({
  className,
}: {
  className?: string
}) {
  const items = useCollectedDetectionsStore((state) => state.items)
  const clearCollected = useCollectedDetectionsStore((state) => state.clear)
  const removeCollected = useCollectedDetectionsStore((state) => state.remove)

  return (
    <section
      data-slot="collected-detections-panel"
      className={cn("glass-panel overflow-hidden", className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground uppercase">
          <RadarIcon className="size-3" />
          Collected for this service
          {items.length > 0 ? (
            <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[0.5625rem]">
              {items.length}
            </span>
          ) : null}
        </div>
        {items.length > 0 ? (
          <Button variant="ghost" size="xs" onClick={clearCollected}>
            Clear
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Verses you present or queue during this service appear here for quick
          reuse.
        </p>
      ) : (
        <div className="grid max-h-[clamp(240px,38vh,440px)] grid-cols-1 overflow-y-auto lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => {
            const actions = getDetectionActions(item.detection)
            return (
              <div
                key={item.key}
                className="queue-item flex items-start gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <SourceBadge source={item.source} />
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {item.reference}
                    </span>
                    {item.useCount > 1 ? (
                      <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[0.5625rem] text-muted-foreground">
                        x{item.useCount}
                      </span>
                    ) : null}
                  </div>
                  {item.text ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.text}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={actions.preview}
                    >
                      <EyeIcon className="size-3" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={actions.present}
                    >
                      <PlayIcon className="size-3" />
                      Go Live
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={actions.queue}
                    >
                      <PlusIcon className="size-3" />
                      Queue
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={"Remove " + item.reference}
                  onClick={() => removeCollected(item.key)}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
