import { describe, expect, it } from "vitest"
import {
  DASHBOARD_WORKSPACE_NAV,
  workspaceNavLabel,
} from "./dashboard-workspace-nav"
import type { DashboardWorkspace } from "@/stores/dashboard-workspace-store"

const EXPECTED_IDS: DashboardWorkspace[] = [
  "live",
  "run-service",
  "service-plans",
  "live-service",
  "hymns",
  "settings",
  "help-legal",
]

describe("dashboard-workspace-nav", () => {
  it("lists all workspaces in reference order", () => {
    expect(DASHBOARD_WORKSPACE_NAV.map((item) => item.id)).toEqual(EXPECTED_IDS)
  })

  it("uses flat nav with dividers before media and settings", () => {
    const withDivider = DASHBOARD_WORKSPACE_NAV.filter((i) => i.dividerBefore)
    expect(withDivider.map((i) => i.id)).toEqual(["hymns", "settings"])
  })

  it("opens planner only for service schedules", () => {
    const plannerItems = DASHBOARD_WORKSPACE_NAV.filter(
      (item) => item.opensPlanner,
    )
    expect(plannerItems).toHaveLength(1)
    expect(plannerItems[0]?.id).toBe("service-plans")
  })

  it("resolves labels for each workspace id", () => {
    for (const id of EXPECTED_IDS) {
      expect(workspaceNavLabel(id)).toBeTruthy()
    }
    expect(workspaceNavLabel("live")).toBe("Live Desk")
    expect(workspaceNavLabel("live-service")).toBe("Broadcast Control")
    expect(workspaceNavLabel("settings")).toBe("System Settings")
    expect(workspaceNavLabel("help-legal")).toBe("Help & Legal")
  })
})
