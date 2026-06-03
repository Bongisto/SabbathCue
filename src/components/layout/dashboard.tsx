import { useEffect, type PointerEvent as ReactPointerEvent } from "react"
import { TransportBar } from "@/components/controls/transport-bar"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { WorkspaceFocusBanner } from "@/components/layout/workspace-focus-banner"
import { cn } from "@/lib/utils"
import { GoLiveWorkspace } from "@/components/layout/go-live-workspace"
import { PrepareWorkspace } from "@/components/layout/prepare-workspace"
import { RehearseWorkspace } from "@/components/layout/rehearse-workspace"
import { useDashboardKeyboardControls } from "@/hooks/use-dashboard-keyboard-controls"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { isContentJob, type DashboardJob } from "@/lib/dashboard-navigation"

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
          ? "relative min-h-full cursor-col-resize rounded-sm bg-border/30 transition-colors after:absolute after:inset-y-2 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full after:bg-primary/30 hover:bg-primary/20 hover:after:bg-primary/60"
          : "relative min-h-2 cursor-row-resize rounded-sm bg-border/30 transition-colors after:absolute after:top-1/2 after:right-2 after:left-2 after:h-0.5 after:-translate-y-1/2 after:rounded-full after:bg-primary/30 hover:bg-primary/20 hover:after:bg-primary/60"
      }
    />
  )
}

function WorkspaceBody({ job }: { job: DashboardJob }) {
  if (job === "prepare") return <PrepareWorkspace />
  if (job === "rehearse") return <RehearseWorkspace />
  if (job === "go-live") return <GoLiveWorkspace />
  return null
}

export function Dashboard() {
  const job = useDashboardWorkspaceStore((s) => s.job)
  const lastContentJob = useDashboardWorkspaceStore((s) => s.lastContentJob)
  const plannerOpen = useServicePlanStore((s) => s.plannerOpen)
  const setJob = useDashboardWorkspaceStore((s) => s.setJob)
  const isDesignerOpen = useBroadcastStore((s) => s.isDesignerOpen)
  const restoreLastContentJob = useDashboardWorkspaceStore(
    (s) => s.restoreLastContentJob,
  )

  const displayJob: DashboardJob =
    job === "design" || job === "settings"
      ? (lastContentJob ?? "go-live")
      : job

  const focusMode =
    job === "design" ? "design" : job === "settings" ? "settings" : null

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

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <TransportBar />
      <OperatorStatusStrip />
      <DashboardShell />
      <div className="flex min-h-0 flex-1 flex-col">
        {focusMode ? <WorkspaceFocusBanner mode={focusMode} /> : null}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            focusMode && "pointer-events-none",
          )}
        >
          {isContentJob(displayJob) ? (
            <WorkspaceBody job={displayJob} />
          ) : null}
          {focusMode ? (
            <div
              className="absolute inset-0 bg-background/55 transition-opacity duration-150"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
