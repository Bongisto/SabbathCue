import { Suspense, lazy } from "react"
import { Button } from "@/components/ui/button"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import type { PrepareView } from "@/lib/dashboard-navigation"

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
  const setPrepareView = useDashboardWorkspaceStore((s) => s.setPrepareView)

  return (
    <div
      data-slot="prepare-workspace"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/70 px-4 py-2">
        {(
          [
            { id: "plans" as PrepareView, label: "Service Plans" },
            { id: "hymns" as PrepareView, label: "Hymns" },
            { id: "slides" as PrepareView, label: "Sermon Slides" },
          ] as const
        ).map((item) => (
          <Button
            key={item.id}
            size="xs"
            variant={prepareView === item.id ? "default" : "outline"}
            aria-pressed={prepareView === item.id}
            onClick={() => setPrepareView(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

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
