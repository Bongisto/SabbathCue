import { Suspense, lazy } from "react"
import { LiveProductionGrid } from "@/components/layout/live-production-grid"
import { ServiceReadinessPanel } from "@/components/layout/service-readiness-panel"

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  })),
)

export function RehearseWorkspace() {
  return (
    <div
      data-slot="rehearse-workspace"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4"
    >
      <ServiceReadinessPanel />
      <LiveProductionGrid />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full rounded-lg border border-border bg-card" />
          }
        >
          <LazyRunServicePage />
        </Suspense>
      </div>
    </div>
  )
}
