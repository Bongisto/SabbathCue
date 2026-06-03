import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { LiveProductionGrid } from "@/components/layout/live-production-grid"
import { ServiceReadinessPanel } from "@/components/layout/service-readiness-panel"
import { WorkZone } from "@/components/layout/work-zone"
import { ResizeHandle } from "@/components/layout/dashboard"
import { clampNumber } from "@/lib/dashboard-layout"
import { useWindowPointerDragCleanup } from "@/hooks/use-window-pointer-drag-cleanup"

const REHEARSE_TOP_HEIGHT_KEY = "sabbathcue.rehearseTopHeight.v1"
const DEFAULT_REHEARSE_TOP_PERCENT = 40

function loadRehearseTopPercent(): number {
  if (typeof window === "undefined") return DEFAULT_REHEARSE_TOP_PERCENT
  try {
    const raw = window.localStorage.getItem(REHEARSE_TOP_HEIGHT_KEY)
    if (!raw) return DEFAULT_REHEARSE_TOP_PERCENT
    return clampNumber(Number(raw), 28, 55)
  } catch {
    return DEFAULT_REHEARSE_TOP_PERCENT
  }
}

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  })),
)

export function RehearseWorkspace() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [topHeightPercent, setTopHeightPercent] = useState(loadRehearseTopPercent)
  const registerPointerDrag = useWindowPointerDragCleanup()

  useEffect(() => {
    try {
      window.localStorage.setItem(REHEARSE_TOP_HEIGHT_KEY, String(topHeightPercent))
    } catch {
      // Ignore storage failures.
    }
  }, [topHeightPercent])

  const startTopResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const content = contentRef.current
      if (!content) return

      const rect = content.getBoundingClientRect()
      const onMove = (moveEvent: PointerEvent) => {
        const next = ((moveEvent.clientY - rect.top) / rect.height) * 100
        setTopHeightPercent(clampNumber(next, 28, 55))
      }
      registerPointerDrag(onMove)
    },
    [registerPointerDrag],
  )

  return (
    <div
      data-slot="rehearse-workspace"
      className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-3"
    >
      <ServiceReadinessPanel />
      <div
        ref={contentRef}
        className="flex min-h-0 flex-1 flex-col gap-1.5"
      >
        <WorkZone
          variant="production"
          label="Production"
          className="min-h-0 flex flex-col"
          style={{ height: `${topHeightPercent}%` }}
        >
          <LiveProductionGrid className="flex-1" />
        </WorkZone>

        <ResizeHandle
          axis="y"
          label="Resize production and run-service sections"
          onPointerDown={startTopResize}
        />

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
    </div>
  )
}
