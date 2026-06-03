import { create } from "zustand"
import {
  applyNavigationPatch,
  type DashboardJob,
  type DashboardNavigationState,
  type LegacyDashboardWorkspace,
  type LiveMode,
  type PrepareView,
  isContentJob,
  loadDashboardNavigation,
  resolveLegacyWorkspace,
  saveDashboardNavigation,
  legacyWorkspaceFromNav,
} from "@/lib/dashboard-navigation"

export type DashboardWorkspace = LegacyDashboardWorkspace

interface DashboardWorkspaceState extends DashboardNavigationState {
  workspace: DashboardWorkspace
  setJob: (job: DashboardJob, options?: { prepareView?: PrepareView }) => void
  setLiveMode: (mode: LiveMode) => void
  setPrepareView: (view: PrepareView) => void
  navigateGoLive: (mode?: LiveMode) => void
  /** @deprecated Use setJob / navigateGoLive — resolves legacy workspace aliases. */
  setWorkspace: (workspace: LegacyDashboardWorkspace) => void
  restoreLastContentJob: () => void
}

function syncFromNav(
  nav: DashboardNavigationState,
): Pick<
  DashboardWorkspaceState,
  "job" | "liveMode" | "prepareView" | "lastContentJob" | "workspace"
> {
  return {
    ...nav,
    workspace: legacyWorkspaceFromNav(nav),
  }
}

const initialNav = loadDashboardNavigation()

export const useDashboardWorkspaceStore = create<DashboardWorkspaceState>(
  (set, get) => ({
    ...syncFromNav(initialNav),

    setJob: (job, options) => {
      const current = get()
      const patch: Partial<DashboardNavigationState> = { job }
      if (job === "prepare" && options?.prepareView) {
        patch.prepareView = options.prepareView
      }
      if (job === "go-live" && current.job !== "go-live") {
        patch.liveMode = current.liveMode
      }
      if (
        isContentJob(current.job) &&
        (job === "design" || job === "settings")
      ) {
        patch.lastContentJob = current.job
      }
      const next = applyNavigationPatch(current, patch)
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },

    setLiveMode: (mode) => {
      const current = get()
      const next = applyNavigationPatch(current, {
        job: "go-live",
        liveMode: mode,
      })
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },

    setPrepareView: (view) => {
      const current = get()
      const next = applyNavigationPatch(current, {
        job: "prepare",
        prepareView: view,
      })
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },

    navigateGoLive: (mode) => {
      const current = get()
      const next = applyNavigationPatch(current, {
        job: "go-live",
        liveMode: mode ?? current.liveMode,
      })
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },

    setWorkspace: (workspace) => {
      const resolved = resolveLegacyWorkspace(workspace)
      const next = applyNavigationPatch(
        {
          job: get().job,
          liveMode: get().liveMode,
          prepareView: get().prepareView,
          lastContentJob: get().lastContentJob,
        },
        resolved,
      )
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },

    restoreLastContentJob: () => {
      const current = get()
      const target = current.lastContentJob ?? "go-live"
      const next = applyNavigationPatch(current, { job: target })
      saveDashboardNavigation(next)
      set(syncFromNav(next))
    },
  }),
)
