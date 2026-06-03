import { Suspense, lazy } from "react"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"

const LazyServicePlanWorkspace = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  })),
)

const LazyHymnWorkspace = lazy(() =>
  import("@/components/hymnal/HymnWorkspace").then((mod) => ({
    default: mod.HymnWorkspace,
  })),
)

const LazySermonSlidesPreparePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.SermonSlidesPreparePage,
  })),
)

export function PrepareWorkspace() {
  const prepareView = useDashboardWorkspaceStore((s) => s.prepareView)

  return (
    <div
      data-slot="prepare-workspace"
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-3"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full rounded-lg border border-border bg-card" />
          }
        >
          {prepareView === "hymns" ? (
            <LazyHymnWorkspace />
          ) : prepareView === "slides" ? (
            <LazySermonSlidesPreparePage />
          ) : (
            <LazyServicePlanWorkspace />
          )}
        </Suspense>
      </div>
    </div>
  )
}
