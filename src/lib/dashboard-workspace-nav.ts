import type { LucideIcon } from "lucide-react"
import {
  BookOpenIcon,
  ClipboardListIcon,
  LayoutGridIcon,
  Music2Icon,
  PlayCircleIcon,
  PresentationIcon,
  RadioIcon,
} from "lucide-react"
import type { DashboardWorkspace } from "@/stores/dashboard-workspace-store"

export type DashboardWorkspaceNavItem = {
  id: DashboardWorkspace
  label: string
  icon: LucideIcon
  opensPlanner?: boolean
}

export const DASHBOARD_WORKSPACE_NAV: DashboardWorkspaceNavItem[] = [
  { id: "live", label: "Live", icon: LayoutGridIcon },
  { id: "run-service", label: "Run Service", icon: PlayCircleIcon },
  {
    id: "service-plans",
    label: "Service Plans",
    icon: ClipboardListIcon,
    opensPlanner: true,
  },
  { id: "live-service", label: "Live Service", icon: RadioIcon },
  { id: "hymns", label: "Hymns", icon: BookOpenIcon },
  { id: "live-hymns", label: "Live Hymns", icon: Music2Icon },
  { id: "sermon-slides", label: "Sermon Slides", icon: PresentationIcon },
]

export function workspaceNavLabel(id: DashboardWorkspace): string {
  return (
    DASHBOARD_WORKSPACE_NAV.find((item) => item.id === id)?.label ?? id
  )
}
