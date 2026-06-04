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
  "live-hymns",
  "sermon-slides",
]

describe("dashboard-workspace-nav", () => {
  it("lists all seven workspaces in order", () => {
    expect(DASHBOARD_WORKSPACE_NAV.map((item) => item.id)).toEqual(
      EXPECTED_IDS
    )
  })

  it("opens planner only for service plans", () => {
    const plannerItems = DASHBOARD_WORKSPACE_NAV.filter(
      (item) => item.opensPlanner
    )
    expect(plannerItems).toHaveLength(1)
    expect(plannerItems[0]?.id).toBe("service-plans")
  })

  it("resolves labels for each workspace id", () => {
    for (const id of EXPECTED_IDS) {
      expect(workspaceNavLabel(id)).toBeTruthy()
    }
  })
})
