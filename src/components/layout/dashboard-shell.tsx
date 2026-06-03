import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { openSettings } from "@/lib/settings-dialog"
import type { DashboardJob, LiveMode, PrepareView } from "@/lib/dashboard-navigation"
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control"

const JOB_OPTIONS: SegmentOption<DashboardJob>[] = [
  { id: "prepare", label: "Prepare", title: "Build plans, hymns, and slides" },
  { id: "rehearse", label: "Rehearse", title: "Run through the service" },
  { id: "go-live", label: "Go Live", title: "Broadcast console", tourId: "go-live" },
  { id: "design", label: "Design", title: "Theme designer" },
  { id: "settings", label: "Settings", title: "App settings" },
]

const LIVE_MODE_OPTIONS: SegmentOption<LiveMode>[] = [
  { id: "sermon", label: "Sermon", title: "Verse search and AI detections", tourId: "go-live-sermon" },
  { id: "service-plan", label: "Service Plan", title: "Live service timeline", tourId: "go-live-service-plan" },
  { id: "hymns", label: "Hymns", title: "Live hymn lyrics", tourId: "go-live-hymns" },
  { id: "slides", label: "Slides", title: "Sermon slides on air", tourId: "go-live-slides" },
]

const PREPARE_OPTIONS: SegmentOption<PrepareView>[] = [
  { id: "plans", label: "Service Plans", title: "Plan builder" },
  { id: "hymns", label: "Hymns", title: "Hymnal library" },
  { id: "slides", label: "Sermon Slides", title: "Slide editor" },
]

export function DashboardShell() {
  const job = useDashboardWorkspaceStore((s) => s.job)
  const liveMode = useDashboardWorkspaceStore((s) => s.liveMode)
  const prepareView = useDashboardWorkspaceStore((s) => s.prepareView)
  const setJob = useDashboardWorkspaceStore((s) => s.setJob)
  const setLiveMode = useDashboardWorkspaceStore((s) => s.setLiveMode)
  const setPrepareView = useDashboardWorkspaceStore((s) => s.setPrepareView)
  const navigateGoLive = useDashboardWorkspaceStore((s) => s.navigateGoLive)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)
  const closePlanner = useServicePlanStore((s) => s.closePlanner)

  const handleJobChange = (nextJob: DashboardJob) => {
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
    <div
      data-slot="dashboard-shell"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card/90 px-3 py-2 transition-colors duration-150"
    >
      <SegmentedControl
        value={job}
        options={JOB_OPTIONS}
        onChange={handleJobChange}
      />

      {job === "go-live" && (
        <>
          <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <SegmentedControl
            value={liveMode}
            options={LIVE_MODE_OPTIONS}
            onChange={setLiveMode}
            size="xs"
          />
        </>
      )}

      {job === "prepare" && (
        <>
          <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <SegmentedControl
            value={prepareView}
            options={PREPARE_OPTIONS}
            onChange={setPrepareView}
            size="xs"
          />
        </>
      )}
    </div>
  )
}
