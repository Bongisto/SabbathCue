export type DashboardJob =
  | "prepare"
  | "rehearse"
  | "go-live"
  | "design"
  | "settings"

export type LiveMode = "sermon" | "service-plan" | "hymns" | "slides"

export type PrepareView = "plans" | "hymns" | "slides"

/** Legacy workspace IDs kept for compatibility with existing call sites. */
export type LegacyDashboardWorkspace =
  | "live"
  | "run-service"
  | "service-plans"
  | "hymns"
  | "live-service"
  | "live-hymns"
  | "sermon-slides"

export interface DashboardNavigationState {
  job: DashboardJob
  liveMode: LiveMode
  prepareView: PrepareView
  lastContentJob: DashboardJob | null
}

export const DASHBOARD_NAV_STORAGE_KEY = "sabbathcue.dashboardNav.v1"

export const DEFAULT_NAVIGATION: DashboardNavigationState = {
  job: "go-live",
  liveMode: "sermon",
  prepareView: "plans",
  lastContentJob: null,
}

const LEGACY_TO_NAV: Record<
  LegacyDashboardWorkspace,
  Pick<DashboardNavigationState, "job" | "liveMode" | "prepareView">
> = {
  live: { job: "go-live", liveMode: "sermon", prepareView: "plans" },
  "live-service": { job: "go-live", liveMode: "service-plan", prepareView: "plans" },
  "live-hymns": { job: "go-live", liveMode: "hymns", prepareView: "plans" },
  "sermon-slides": { job: "go-live", liveMode: "slides", prepareView: "plans" },
  "run-service": { job: "rehearse", liveMode: "sermon", prepareView: "plans" },
  "service-plans": { job: "prepare", liveMode: "sermon", prepareView: "plans" },
  hymns: { job: "prepare", liveMode: "sermon", prepareView: "hymns" },
}

export function resolveLegacyWorkspace(
  workspace: LegacyDashboardWorkspace,
): DashboardNavigationState {
  const mapped = LEGACY_TO_NAV[workspace]
  return {
    ...DEFAULT_NAVIGATION,
    job: mapped.job,
    liveMode: mapped.liveMode,
    prepareView: mapped.prepareView,
  }
}

export function legacyWorkspaceFromNav(
  state: Pick<DashboardNavigationState, "job" | "liveMode" | "prepareView">,
): LegacyDashboardWorkspace {
  if (state.job === "prepare") {
    return state.prepareView === "hymns" ? "hymns" : "service-plans"
  }
  if (state.job === "rehearse") return "run-service"
  if (state.job === "go-live") {
    switch (state.liveMode) {
      case "service-plan":
        return "live-service"
      case "hymns":
        return "live-hymns"
      case "slides":
        return "sermon-slides"
      default:
        return "live"
    }
  }
  return "live"
}

export function isContentJob(job: DashboardJob): boolean {
  return job === "prepare" || job === "rehearse" || job === "go-live"
}

export function loadDashboardNavigation(): DashboardNavigationState {
  if (typeof window === "undefined") return { ...DEFAULT_NAVIGATION }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_NAV_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_NAVIGATION }
    const parsed = JSON.parse(raw) as Partial<DashboardNavigationState>
    return {
      job: parsed.job ?? DEFAULT_NAVIGATION.job,
      liveMode: parsed.liveMode ?? DEFAULT_NAVIGATION.liveMode,
      prepareView: parsed.prepareView ?? DEFAULT_NAVIGATION.prepareView,
      lastContentJob:
        parsed.lastContentJob && isContentJob(parsed.lastContentJob)
          ? parsed.lastContentJob
          : null,
    }
  } catch {
    return { ...DEFAULT_NAVIGATION }
  }
}

export function saveDashboardNavigation(state: DashboardNavigationState): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(DASHBOARD_NAV_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures.
  }
}

export function applyNavigationPatch(
  current: DashboardNavigationState,
  patch: Partial<DashboardNavigationState>,
): DashboardNavigationState {
  const next: DashboardNavigationState = {
    job: patch.job ?? current.job,
    liveMode: patch.liveMode ?? current.liveMode,
    prepareView: patch.prepareView ?? current.prepareView,
    lastContentJob:
      patch.lastContentJob !== undefined
        ? patch.lastContentJob
        : current.lastContentJob,
  }

  if (isContentJob(next.job)) {
    next.lastContentJob = next.job
  }

  return next
}
