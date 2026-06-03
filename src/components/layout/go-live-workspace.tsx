import { Suspense, lazy } from "react"
import { LiveProductionGrid } from "@/components/layout/live-production-grid"
import { SermonModeContext } from "@/components/layout/sermon-mode-context"
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

const LIVE_MODE_LABELS: Record<LiveMode, string> = {
  sermon: "Sermon",
  "service-plan": "Service Plan",
  hymns: "Hymns",
  slides: "Slides",
}

function GoLiveModeContext({ mode }: { mode: LiveMode }) {
  if (mode === "sermon") {
    return <SermonModeContext />
  }

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

  return (
    <div
      data-slot="go-live-workspace"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4"
    >
      <ServiceReadinessPanel />
      <p className="text-xs text-muted-foreground">
        Live mode:{" "}
        <span className="font-medium text-foreground">
          {LIVE_MODE_LABELS[liveMode]}
        </span>
      </p>
      <LiveProductionGrid />
      <GoLiveModeContext mode={liveMode} />
    </div>
  )
}
