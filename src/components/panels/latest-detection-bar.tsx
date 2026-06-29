import { EyeIcon, PlayIcon, PlusIcon, RadarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ConfidenceDot } from "@/components/ui/confidence-dot"
import { useDetection } from "@/hooks/use-detection"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import {
  getDetectionActions,
  SourceBadge,
} from "@/components/panels/detections-panel"
import type { DetectionResult } from "@/types"

function LatestDetectionContent({ detection }: { detection: DetectionResult }) {
  const actions = getDetectionActions(detection)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <ConfidenceDot confidence={detection.confidence} />
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {Math.round(detection.confidence * 100)}%
      </span>
      <SourceBadge source={detection.source} />
      <span className="shrink-0 text-sm font-semibold text-foreground">
        {detection.verse_ref}
      </span>
      {detection.verse_text ? (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {detection.verse_text}
        </span>
      ) : null}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          title="Preview"
          aria-label="Preview"
          onClick={actions.preview}
        >
          <EyeIcon className="size-3" />
        </Button>
        <Button
          size="icon-xs"
          title="Send live"
          aria-label="Send live"
          onClick={actions.present}
        >
          <PlayIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Add to queue"
          aria-label="Add to queue"
          onClick={actions.queue}
        >
          <PlusIcon className="size-3" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Compact, single-line Live Desk signal: surfaces only the most recent detection and
 * links to the dedicated Detections page for the full history. Action intent is shared
 * with the detection cards via getDetectionActions, so all detection types behave
 * identically here and on the page.
 */
export function LatestDetectionBar({ className }: { className?: string }) {
  const { detections } = useDetection()
  const latest = detections[0] ?? null

  return (
    <div
      data-slot="latest-detection-bar"
      className={cn(
        "glass-panel flex items-center gap-3 overflow-hidden px-3 py-2",
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground uppercase">
        <RadarIcon className="size-3" />
        Latest
      </div>

      {latest ? (
        <LatestDetectionContent detection={latest} />
      ) : (
        <span className="flex-1 text-xs text-muted-foreground">
          No detections yet
        </span>
      )}

      <Button
        variant="ghost"
        size="xs"
        className="ml-auto shrink-0"
        onClick={() =>
          useDashboardWorkspaceStore.getState().setWorkspace("detections")
        }
      >
        Open Detections
      </Button>
    </div>
  )
}
