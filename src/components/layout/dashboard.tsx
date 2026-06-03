import { useEffect, type PointerEvent as ReactPointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { TransportBar } from "@/components/controls/transport-bar"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { GoLiveWorkspace } from "@/components/layout/go-live-workspace"
import { PrepareWorkspace } from "@/components/layout/prepare-workspace"
import { RehearseWorkspace } from "@/components/layout/rehearse-workspace"
import { useDashboardKeyboardControls } from "@/hooks/use-dashboard-keyboard-controls"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { openSettings } from "@/lib/settings-dialog"
import type { DashboardJob, LiveMode } from "@/lib/dashboard-navigation"

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
          ? "relative cursor-col-resize rounded-sm bg-border/40 transition-colors after:absolute after:inset-y-1 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-muted-foreground/40 hover:bg-primary/50"
          : "relative cursor-row-resize rounded-sm bg-border/40 transition-colors after:absolute after:top-1/2 after:right-1 after:left-1 after:h-px after:-translate-y-1/2 after:bg-muted-foreground/40 hover:bg-primary/50"
      }
    />
  )
}

const JOB_BUTTONS: { id: DashboardJob; label: string }[] = [
  { id: "prepare", label: "Prepare" },
  { id: "rehearse", label: "Rehearse" },
  { id: "go-live", label: "Go Live" },
  { id: "design", label: "Design" },
  { id: "settings", label: "Settings" },
]

const LIVE_MODE_BUTTONS: { id: LiveMode; label: string }[] = [
  { id: "sermon", label: "Sermon" },
  { id: "service-plan", label: "Service Plan" },
  { id: "hymns", label: "Hymns" },
  { id: "slides", label: "Slides" },
]

export function Dashboard() {
  const job = useDashboardWorkspaceStore((s) => s.job)
  const liveMode = useDashboardWorkspaceStore((s) => s.liveMode)
  const setJob = useDashboardWorkspaceStore((s) => s.setJob)
  const setLiveMode = useDashboardWorkspaceStore((s) => s.setLiveMode)
  const navigateGoLive = useDashboardWorkspaceStore((s) => s.navigateGoLive)
  const restoreLastContentJob = useDashboardWorkspaceStore(
    (s) => s.restoreLastContentJob,
  )
  const plannerOpen = useServicePlanStore((s) => s.plannerOpen)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)
  const closePlanner = useServicePlanStore((s) => s.closePlanner)
  const isDesignerOpen = useBroadcastStore((s) => s.isDesignerOpen)

  useDashboardKeyboardControls()

  useEffect(() => {
    if (plannerOpen && job !== "prepare") {
      setJob("prepare")
    }
  }, [plannerOpen, setJob, job])

  useEffect(() => {
    if (job === "design" && !isDesignerOpen) {
      restoreLastContentJob()
    }
  }, [isDesignerOpen, job, restoreLastContentJob])

  const handleJobClick = (nextJob: DashboardJob) => {
    if (nextJob === "prepare") {
      openPlanner()
      setJob("prepare")
      return
    }
    if (nextJob === "rehearse") {
      closePlanner()
      setJob("rehearse")
      return
    }
    if (nextJob === "go-live") {
      closePlanner()
      navigateGoLive()
      return
    }
    if (nextJob === "design") {
      useBroadcastStore.getState().setDesignerOpen(true)
      setJob("design")
      return
    }
    if (nextJob === "settings") {
      openSettings()
      setJob("settings")
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <TransportBar />
      <OperatorStatusStrip />

      <div
        data-slot="dashboard-job-nav"
        className="flex flex-wrap items-center gap-2 border-b border-border bg-card/70 px-4 py-2"
      >
        {JOB_BUTTONS.map((item) => (
          <Button
            key={item.id}
            size="xs"
            variant={job === item.id ? "default" : "outline"}
            aria-pressed={job === item.id}
            data-tour={item.id === "go-live" ? "go-live" : undefined}
            onClick={() => handleJobClick(item.id)}
          >
            {item.label}
          </Button>
        ))}

        {job === "go-live" && (
          <>
            <div className="mx-1 h-5 w-px bg-border" />
            {LIVE_MODE_BUTTONS.map((mode) => (
              <Button
                key={mode.id}
                size="xs"
                variant={liveMode === mode.id ? "default" : "outline"}
                aria-pressed={liveMode === mode.id}
                data-tour={`go-live-${mode.id}`}
                onClick={() => setLiveMode(mode.id)}
              >
                {mode.label}
              </Button>
            ))}
          </>
        )}
      </div>

      {job === "prepare" ? (
        <PrepareWorkspace />
      ) : job === "rehearse" ? (
        <RehearseWorkspace />
      ) : job === "go-live" ? (
        <GoLiveWorkspace />
      ) : job === "design" || job === "settings" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          {job === "design"
            ? "Theme Designer is open. Close it to return to your previous workspace."
            : "Settings is open. Close the dialog to return to your previous workspace."}
        </div>
      ) : null}
    </div>
  )
}
