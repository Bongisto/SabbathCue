import type { LucideIcon } from "lucide-react"
import {
  BookOpenIcon,
  ClipboardListIcon,
  LayoutGridIcon,
  Music2Icon,
  PlayCircleIcon,
  PresentationIcon,
  RadioIcon,
  SettingsIcon,
  LifeBuoyIcon,
} from "lucide-react"
import type { DashboardWorkspace } from "@/stores/dashboard-workspace-store"

export type DashboardWorkspaceNavItem = {
  id: DashboardWorkspace
  label: string
  icon: LucideIcon
  /** Insert a divider before this item (reference flat nav). */
  dividerBefore?: boolean
  opensPlanner?: boolean
}

/** Flat sidebar order matching reference HTML. */
export const DASHBOARD_WORKSPACE_NAV: DashboardWorkspaceNavItem[] = [
  { id: "live", label: "Live Desk", icon: LayoutGridIcon },
  { id: "run-service", label: "Run Service Flow", icon: PlayCircleIcon },
  {
    id: "service-plans",
    label: "Service Schedules",
    icon: ClipboardListIcon,
    opensPlanner: true,
  },
  { id: "live-service", label: "Broadcast Overlays", icon: RadioIcon },
  { id: "hymns", label: "SDA Hymns Search", icon: BookOpenIcon, dividerBefore: true },
  { id: "live-hymns", label: "Lyric Presenter", icon: Music2Icon },
  { id: "sermon-slides", label: "Sermon Slide Studio", icon: PresentationIcon },
  {
    id: "settings",
    label: "System Settings",
    icon: SettingsIcon,
    dividerBefore: true,
  },
  { id: "help-legal", label: "Help & Legal", icon: LifeBuoyIcon },
]

export function workspaceNavLabel(id: DashboardWorkspace): string {
  return DASHBOARD_WORKSPACE_NAV.find((item) => item.id === id)?.label ?? id
}
