// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import {
  DASHBOARD_NAV_STORAGE_KEY,
  DEFAULT_NAVIGATION,
  resolveLegacyWorkspace,
} from "@/lib/dashboard-navigation"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"

describe("dashboard-workspace-store", () => {
  beforeEach(() => {
    window.localStorage.removeItem(DASHBOARD_NAV_STORAGE_KEY)
    useDashboardWorkspaceStore.setState({
      ...DEFAULT_NAVIGATION,
      workspace: "live",
      lastContentJob: null,
    })
  })

  it("defaults to go-live sermon mode", () => {
    const state = useDashboardWorkspaceStore.getState()
    expect(state.job).toBe("go-live")
    expect(state.liveMode).toBe("sermon")
    expect(state.workspace).toBe("live")
  })

  it("maps legacy live workspaces to job and liveMode", () => {
    useDashboardWorkspaceStore.getState().setWorkspace("live-service")
    expect(useDashboardWorkspaceStore.getState().job).toBe("go-live")
    expect(useDashboardWorkspaceStore.getState().liveMode).toBe("service-plan")

    useDashboardWorkspaceStore.getState().setWorkspace("live-hymns")
    expect(useDashboardWorkspaceStore.getState().liveMode).toBe("hymns")

    useDashboardWorkspaceStore.getState().setWorkspace("sermon-slides")
    expect(useDashboardWorkspaceStore.getState().liveMode).toBe("slides")
  })

  it("maps run-service to rehearse", () => {
    useDashboardWorkspaceStore.getState().setWorkspace("run-service")
    expect(useDashboardWorkspaceStore.getState().job).toBe("rehearse")
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("run-service")
  })

  it("maps service-plans and hymns to prepare", () => {
    useDashboardWorkspaceStore.getState().setWorkspace("service-plans")
    expect(useDashboardWorkspaceStore.getState().job).toBe("prepare")
    expect(useDashboardWorkspaceStore.getState().prepareView).toBe("plans")

    useDashboardWorkspaceStore.getState().setWorkspace("hymns")
    expect(useDashboardWorkspaceStore.getState().job).toBe("prepare")
    expect(useDashboardWorkspaceStore.getState().prepareView).toBe("hymns")
  })

  it("preserves liveMode when switching modes within go-live", () => {
    useDashboardWorkspaceStore.getState().navigateGoLive("service-plan")
    useDashboardWorkspaceStore.getState().setLiveMode("hymns")
    expect(useDashboardWorkspaceStore.getState().liveMode).toBe("hymns")
    expect(useDashboardWorkspaceStore.getState().job).toBe("go-live")
  })

  it("tracks last content job for design/settings restore", () => {
    useDashboardWorkspaceStore.getState().setJob("prepare")
    useDashboardWorkspaceStore.getState().setJob("design")
    expect(useDashboardWorkspaceStore.getState().lastContentJob).toBe("prepare")

    useDashboardWorkspaceStore.getState().restoreLastContentJob()
    expect(useDashboardWorkspaceStore.getState().job).toBe("prepare")
  })

  it("persists navigation to localStorage", () => {
    useDashboardWorkspaceStore.getState().navigateGoLive("slides")
    const raw = window.localStorage.getItem(DASHBOARD_NAV_STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { job: string; liveMode: string }
    expect(parsed.job).toBe("go-live")
    expect(parsed.liveMode).toBe("slides")
  })
})

describe("resolveLegacyWorkspace", () => {
  it("matches store alias table", () => {
    expect(resolveLegacyWorkspace("live").job).toBe("go-live")
    expect(resolveLegacyWorkspace("run-service").job).toBe("rehearse")
    expect(resolveLegacyWorkspace("hymns").prepareView).toBe("hymns")
  })
})
