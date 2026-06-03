import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { cn } from "@/lib/utils"

export function LiveProductionGrid({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      data-slot="live-production-grid"
      className={cn(
        "grid h-full min-h-0 gap-1.5 *:min-h-0",
        "grid-cols-1 xl:grid-cols-[300px_minmax(320px,1fr)_minmax(320px,1fr)_320px]",
        className,
      )}
      style={style}
    >
      <TranscriptPanel />
      <PreviewPanel showTakeLive />
      <LiveOutputPanel showTakeLive={false} />
      <QueuePanel />
    </div>
  )
}
