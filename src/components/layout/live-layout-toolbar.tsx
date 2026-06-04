import { SegmentedControl } from "@/components/ui/segmented-control"
import { Button } from "@/components/ui/button"
import type { DashboardViewMode } from "@/lib/dashboard-layout"

const VIEW_MODE_OPTIONS: { value: DashboardViewMode; label: string }[] = [
  { value: "balanced", label: "balanced" },
  { value: "broadcast", label: "broadcast" },
  { value: "study", label: "study" },
]

type LiveLayoutToolbarProps = {
  viewMode: DashboardViewMode
  onViewModeChange: (mode: DashboardViewMode) => void
  onResetLayout: () => void
}

export function LiveLayoutToolbar({
  viewMode,
  onViewModeChange,
  onResetLayout,
}: LiveLayoutToolbarProps) {
  return (
    <div
      data-slot="live-layout-toolbar"
      className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/[0.06] bg-slate-950/50 px-4 py-2"
    >
      <SegmentedControl
        aria-label="Live desk layout"
        value={viewMode}
        options={VIEW_MODE_OPTIONS}
        onChange={onViewModeChange}
      />
      <span className="text-xs text-muted-foreground">
        Drag labeled dividers to resize panels
      </span>
      <Button
        size="xs"
        variant="ghost"
        onClick={onResetLayout}
        className="ml-auto text-muted-foreground hover:text-foreground"
      >
        Reset layout
      </Button>
    </div>
  )
}
