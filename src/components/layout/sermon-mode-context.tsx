import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Button } from "@/components/ui/button"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { ResizeHandle } from "@/components/layout/dashboard"
import {
  clampNumber,
  layoutStateFromPreset,
  loadDashboardLayoutState,
  saveDashboardLayoutState,
  type DashboardViewMode,
} from "@/lib/dashboard-layout"
import { useWindowPointerDragCleanup } from "@/hooks/use-window-pointer-drag-cleanup"

export function SermonModeContext() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === "undefined" ? 1920 : window.innerWidth,
  )
  const [layout, setLayout] = useState(loadDashboardLayoutState)
  const isCompact = windowWidth < 1400
  const viewMode = layout.viewMode
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
      data-slot="sermon-mode-context"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {(["balanced", "broadcast", "study"] as const).map((mode) => (
          <Button
            key={mode}
            size="xs"
            variant={viewMode === mode ? "default" : "outline"}
            onClick={() => applyViewMode(mode)}
            className="capitalize"
          >
            {mode}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">
          Drag labeled dividers to resize panels
        </span>
        <Button size="xs" variant="ghost" onClick={resetLayout} className="ml-auto">
          Reset layout
        </Button>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-3"
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
    </div>
  )
}
