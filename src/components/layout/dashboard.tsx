import {
  useCallback,
  useEffect,
  lazy,
  useRef,
  useState,
  Suspense,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { AppControllerHeader } from "@/components/layout/app-controller-header"
import { LiveLayoutToolbar } from "@/components/layout/live-layout-toolbar"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { useDashboardKeyboardControls } from "@/hooks/use-dashboard-keyboard-controls"
import {
  clampNumber,
  layoutStateFromPreset,
  loadDashboardLayoutState,
  saveDashboardLayoutState,
  type DashboardViewMode,
} from "@/lib/dashboard-layout"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

const LazyHymnWorkspace = lazy(() =>
  import("@/components/hymnal/HymnWorkspace").then((mod) => ({
    default: mod.HymnWorkspace,
  }))
)

const LazyServicePlanWorkspace = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  }))
)

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  }))
)

const LazyLiveServicePlanPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveServicePlanPage,
  }))
)

const LazyLiveHymnPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveHymnPage,
  }))
)

const LazySermonSlidesPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.SermonSlidesPage,
  }))
)

export function ResizeHandle({
  axis,
  label,
  onPointerDown,
}: {
  axis: "x" | "y"
  label: string
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      title={label}
      onPointerDown={onPointerDown}
      className={
        axis === "x"
          ? "relative cursor-col-resize rounded-sm bg-border/40 transition-colors after:absolute after:inset-y-1 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-muted-foreground/40 hover:bg-[var(--brand-accent)]/30 dark:hover:bg-[var(--brand-accent-glow)]"
          : "relative cursor-row-resize rounded-sm bg-border/40 transition-colors after:absolute after:top-1/2 after:right-1 after:left-1 after:h-px after:-translate-y-1/2 after:bg-muted-foreground/40 hover:bg-[var(--brand-accent)]/30 dark:hover:bg-[var(--brand-accent-glow)]"
      }
    />
  )
}

export function Dashboard() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === "undefined" ? 1920 : window.innerWidth
  )
  const workspace = useDashboardWorkspaceStore((s) => s.workspace)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const plannerOpen = useServicePlanStore((s) => s.plannerOpen)
  const [layout, setLayout] = useState(loadDashboardLayoutState)
  const isCompact = windowWidth < 1400
  const viewMode = layout.viewMode
  const topHeightPercent = layout.topHeightPercent
  const transcriptWidth = layout.transcriptWidth
  const queueWidth = layout.queueWidth
  const detectionsWidth = layout.detectionsWidth

  useDashboardKeyboardControls()

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    saveDashboardLayoutState(layout)
  }, [layout])

  useEffect(() => {
    if (plannerOpen && workspace !== "service-plans") {
      setWorkspace("service-plans")
    }
  }, [plannerOpen, setWorkspace, workspace])

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
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    []
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
            520
          ),
        }))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [transcriptWidth]
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
            520
          ),
        }))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [queueWidth]
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
            760
          ),
        }))
      }
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [detectionsWidth]
  )

  const workspaceContent =
    workspace === "service-plans" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazyServicePlanWorkspace />
      </Suspense>
    ) : workspace === "hymns" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazyHymnWorkspace />
      </Suspense>
    ) : workspace === "run-service" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazyRunServicePage />
      </Suspense>
    ) : workspace === "live-service" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazyLiveServicePlanPage />
      </Suspense>
    ) : workspace === "live-hymns" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazyLiveHymnPage />
      </Suspense>
    ) : workspace === "sermon-slides" ? (
      <Suspense
        fallback={
          <div className="glass-panel h-full rounded-2xl border border-border bg-card" />
        }
      >
        <LazySermonSlidesPage />
      </Suspense>
    ) : (
      <div
        ref={contentRef}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
          <div
            className="grid min-h-0 gap-3 *:min-h-0"
            style={{
              height: `${topHeightPercent}%`,
              gridTemplateColumns: isCompact
                ? `minmax(0, 1fr) minmax(0, 1fr)`
                : `${transcriptWidth}px 6px minmax(280px, 1fr) minmax(280px, 1fr) 6px ${queueWidth}px`,
              gridTemplateRows: isCompact
                ? `minmax(0, 1fr) minmax(0, 0.8fr)`
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
            <PreviewPanel />
            <LiveOutputPanel />
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

          <ResizeHandle
            axis="y"
            label="Resize top and bottom dashboard sections"
            onPointerDown={startTopResize}
          />

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

  return (
    <div className="app-controller-shell fixed inset-0 flex flex-col overflow-hidden bg-background">
      <AppControllerHeader />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <WorkspaceSidebar />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <OperatorStatusStrip />

          {workspace === "live" && (
            <LiveLayoutToolbar
              viewMode={viewMode}
              onViewModeChange={applyViewMode}
              onResetLayout={resetLayout}
            />
          )}

          <div
            key={workspace}
            className="view-pane-enter flex min-h-0 flex-1 flex-col overflow-hidden p-4"
          >
            {workspaceContent}
          </div>
        </main>
      </div>
    </div>
  )
}
