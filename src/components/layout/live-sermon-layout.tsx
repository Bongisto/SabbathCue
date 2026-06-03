import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { ResizeHandle } from "@/components/layout/dashboard"
import { WorkZone } from "@/components/layout/work-zone"
import {
  clampNumber,
  layoutStateFromPreset,
  loadDashboardLayoutState,
  saveDashboardLayoutState,
  type DashboardViewMode,
} from "@/lib/dashboard-layout"
import { useWindowPointerDragCleanup } from "@/hooks/use-window-pointer-drag-cleanup"

const LAYOUT_OPTIONS = [
  { id: "balanced" as const, label: "Balanced" },
  { id: "broadcast" as const, label: "Broadcast" },
  { id: "study" as const, label: "Study" },
]

export function LiveSermonLayout() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === "undefined" ? 1920 : window.innerWidth,
  )
  const [layout, setLayout] = useState(loadDashboardLayoutState)
  const isCompact = windowWidth < 1400
  const viewMode = layout.viewMode
  const topHeightPercent = layout.topHeightPercent
  const transcriptWidth = layout.transcriptWidth
  const queueWidth = layout.queueWidth
  const detectionsWidth = layout.detectionsWidth
  const registerPointerDrag = useWindowPointerDragCleanup()

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    saveDashboardLayoutState(layout)
  }, [layout])

  const applyViewMode = (mode: DashboardViewMode) => {
    setLayout(layoutStateFromPreset(mode))
  }

  const resetLayout = () => {
    setLayout(layoutStateFromPreset("balanced"))
  }

  const startTopResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const content = contentRef.current
      if (!content) return

      const rect = content.getBoundingClientRect()
      const onMove = (moveEvent: PointerEvent) => {
        const next = ((moveEvent.clientY - rect.top) / rect.height) * 100
        setLayout((current) => ({
          ...current,
          topHeightPercent: clampNumber(next, 34, 68),
        }))
      }
      registerPointerDrag(onMove)
    },
    [registerPointerDrag],
  )

  const startTranscriptResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = transcriptWidth
      const onMove = (moveEvent: PointerEvent) => {
        setLayout((current) => ({
          ...current,
          transcriptWidth: clampNumber(
            startWidth + moveEvent.clientX - startX,
            240,
            520,
          ),
        }))
      }
      registerPointerDrag(onMove)
    },
    [transcriptWidth, registerPointerDrag],
  )

  const startQueueResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = queueWidth
      const onMove = (moveEvent: PointerEvent) => {
        setLayout((current) => ({
          ...current,
          queueWidth: clampNumber(
            startWidth - (moveEvent.clientX - startX),
            240,
            520,
          ),
        }))
      }
      registerPointerDrag(onMove)
    },
    [queueWidth, registerPointerDrag],
  )

  const startDetectionsResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = detectionsWidth
      const onMove = (moveEvent: PointerEvent) => {
        setLayout((current) => ({
          ...current,
          detectionsWidth: clampNumber(
            startWidth - (moveEvent.clientX - startX),
            360,
            760,
          ),
        }))
      }
      registerPointerDrag(onMove)
    },
    [detectionsWidth, registerPointerDrag],
  )

  return (
    <div
      ref={contentRef}
      data-slot="live-sermon-layout"
      className="flex min-h-0 flex-1 flex-col gap-1.5"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
        <SegmentedControl
          value={viewMode}
          options={LAYOUT_OPTIONS}
          onChange={applyViewMode}
          size="xs"
        />
        <span className="text-[0.6875rem] text-muted-foreground">
          Drag dividers to resize
        </span>
        <Button size="xs" variant="ghost" onClick={resetLayout} className="ml-auto">
          Reset layout
        </Button>
      </div>

      <WorkZone
        variant="production"
        label="Production"
        className="min-h-0 p-1.5"
        style={{ height: `${topHeightPercent}%` }}
      >
        <div
          className="grid h-full min-h-0 gap-1.5 *:min-h-0"
          style={{
            gridTemplateColumns: isCompact
              ? "minmax(0, 1fr) minmax(0, 1fr)"
              : `${transcriptWidth}px 6px minmax(280px, 1fr) minmax(280px, 1fr) 6px ${queueWidth}px`,
            gridTemplateRows: isCompact
              ? "minmax(0, 1fr) minmax(0, 0.8fr)"
              : undefined,
          }}
        >
          <div className={isCompact ? "min-h-0" : "contents"}>
            <TranscriptPanel />
          </div>
          {!isCompact && (
            <ResizeHandle
              axis="x"
              label="Resize transcript panel"
              onPointerDown={startTranscriptResize}
            />
          )}
          <PreviewPanel showTakeLive />
          <LiveOutputPanel showTakeLive={false} />
          {!isCompact && (
            <ResizeHandle
              axis="x"
              label="Resize queue panel"
              onPointerDown={startQueueResize}
            />
          )}
          <div className={isCompact ? "min-h-0" : "contents"}>
            <QueuePanel />
          </div>
        </div>
      </WorkZone>

      <ResizeHandle
        axis="y"
        label="Resize top and bottom dashboard sections"
        onPointerDown={startTopResize}
      />

      <WorkZone
        variant="bible"
        label="Bible & detections"
        className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5"
      >
        <div
          className="grid min-h-0 flex-1 gap-1.5"
          style={{
            gridTemplateColumns: isCompact
              ? "minmax(0, 1fr)"
              : `minmax(0, 1fr) 6px ${detectionsWidth}px`,
            gridTemplateRows: isCompact
              ? "minmax(0, 1fr) minmax(220px, 0.55fr)"
              : undefined,
          }}
        >
          <SearchPanel />
          {!isCompact && (
            <ResizeHandle
              axis="x"
              label="Resize recent detections panel"
              onPointerDown={startDetectionsResize}
            />
          )}
          <DetectionsPanel />
        </div>
      </WorkZone>
    </div>
  )
}
