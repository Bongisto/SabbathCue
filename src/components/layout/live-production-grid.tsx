import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"

export function LiveProductionGrid() {
  return (
    <div
      data-slot="live-production-grid"
      className="grid min-h-[360px] shrink-0 grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(320px,1fr)_minmax(320px,1fr)_320px]"
    >
      <TranscriptPanel />
      <PreviewPanel showTakeLive />
      <LiveOutputPanel showTakeLive={false} />
      <QueuePanel />
    </div>
  )
}
