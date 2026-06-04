import { useEffect, lazy, Suspense } from "react"
import { AppControllerHeader } from "@/components/layout/app-controller-header"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { SearchPanel } from "@/components/panels/search-panel"
import { useDashboardKeyboardControls } from "@/hooks/use-dashboard-keyboard-controls"
import { cn } from "@/lib/utils"
import {
  accentThemeClassName,
  useAccentThemeStore,
} from "@/stores/accent-theme-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

const LazyHymnWorkspace = lazy(() =>
  import("@/components/hymnal/HymnWorkspace").then((mod) => ({
    default: mod.HymnWorkspace,
  })),
)

const LazyServicePlanWorkspace = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  })),
)

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  })),
)

const LazyLiveServicePlanPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveServicePlanPage,
  })),
)

const LazyLiveHymnPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveHymnPage,
  })),
)

const LazySermonSlidesPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.SermonSlidesPage,
  })),
)

const LazySettingsPage = lazy(() =>
  import("@/components/settings/SettingsPage").then((mod) => ({
    default: mod.SettingsPage,
  })),
)

function WorkspaceFallback() {
  return <div className="glass-panel min-h-[200px] animate-pulse" />
}

function LiveDeskPage() {
  return (
    <div className="view-pane grid grid-cols-12 gap-5">
      <div className="glass-panel col-span-12 flex h-[520px] flex-col xl:col-span-3">
        <TranscriptPanel />
      </div>

      <div className="col-span-12 grid h-fit grid-cols-1 gap-5 md:grid-cols-2 xl:col-span-9">
        <PreviewPanel className="h-[330px]" />
        <LiveOutputPanel className="h-[330px]" />
        <QueuePanel className="h-[290px]" />
        <DetectionsPanel className="h-[290px]" />
      </div>

      <div className="glass-panel col-span-12 p-5">
        <SearchPanel embedded />
      </div>
    </div>
  )
}

export function Dashboard() {
  const workspace = useDashboardWorkspaceStore((s) => s.workspace)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const plannerOpen = useServicePlanStore((s) => s.plannerOpen)
  const accentTheme = useAccentThemeStore((s) => s.theme)
  const hydrateAccent = useAccentThemeStore((s) => s.hydrate)

  useDashboardKeyboardControls()

  useEffect(() => {
    hydrateAccent()
  }, [hydrateAccent])

  useEffect(() => {
    if (plannerOpen && workspace !== "service-plans") {
      setWorkspace("service-plans")
    }
  }, [plannerOpen, setWorkspace, workspace])

  const workspaceContent =
    workspace === "live" ? (
      <LiveDeskPage />
    ) : workspace === "service-plans" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyServicePlanWorkspace />
      </Suspense>
    ) : workspace === "hymns" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyHymnWorkspace />
      </Suspense>
    ) : workspace === "run-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyRunServicePage />
      </Suspense>
    ) : workspace === "live-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLiveServicePlanPage />
      </Suspense>
    ) : workspace === "live-hymns" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLiveHymnPage />
      </Suspense>
    ) : workspace === "sermon-slides" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazySermonSlidesPage />
      </Suspense>
    ) : workspace === "settings" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazySettingsPage />
      </Suspense>
    ) : null

  return (
    <div
      id="bodyThemeContainer"
      className={cn(
        accentThemeClassName(accentTheme),
        "fixed inset-0 overflow-hidden",
      )}
    >
      <div className="app-shell">
        <AppControllerHeader />

        <div className="flex flex-1 overflow-hidden">
          <WorkspaceSidebar />

          <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
            <OperatorStatusStrip />

            <div
              key={workspace}
              className="scrollbar-thin flex-1 overflow-y-auto p-5"
            >
              {workspaceContent}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
