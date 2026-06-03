import { Suspense, lazy } from "react"
import { LiveSermonLayout } from "@/components/layout/live-sermon-layout"
import { ServiceReadinessPanel } from "@/components/layout/service-readiness-panel"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import type { LiveMode } from "@/lib/dashboard-navigation"

const LazyLiveServicePlanContext = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveServicePlanContext,
  })),
)

const LazyLiveHymnContext = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveHymnContext,
  })),
)

const LazySermonSlidesLiveContext = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.SermonSlidesLiveContext,
  })),
)

function GoLiveModeContext({ mode }: { mode: LiveMode }) {
  const fallback = (
    <div className="h-full min-h-[200px] rounded-lg border border-border bg-card" />
  )

  if (mode === "service-plan") {
    return (
      <Suspense fallback={fallback}>
        <LazyLiveServicePlanContext />
      </Suspense>
    )
  }

  if (mode === "hymns") {
    return (
      <Suspense fallback={fallback}>
        <LazyLiveHymnContext />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={fallback}>
      <LazySermonSlidesLiveContext />
    </Suspense>
  )
}

export function GoLiveWorkspace() {
  const liveMode = useDashboardWorkspaceStore((s) => s.liveMode)

  if (liveMode === "sermon") {
    return (
      <div
        data-slot="go-live-workspace"
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-3"
      >
        <ServiceReadinessPanel />
        <LiveSermonLayout />
      </div>
    )
  }

  return (
    <div
      data-slot="go-live-workspace"
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <GoLiveModeContext mode={liveMode} />
    </div>
  )
}
