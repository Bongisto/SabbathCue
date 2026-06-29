import { create } from "zustand"
import { emitTo } from "@tauri-apps/api/event"
import type {
  BroadcastTheme,
  BroadcastTransition,
  BroadcastTransitionType,
  PresentationRenderData,
} from "@/types"
import {
  createOutputIssueSlice,
  selectLatestOutputIssue,
  type OutputIssueSlice,
} from "@/stores/broadcast/output-issue-slice"
import {
  createDesignerSlice,
  type DesignerSlice,
} from "@/stores/broadcast/designer-slice"
import {
  createMonitorSlice,
  type MonitorSlice,
} from "@/stores/broadcast/monitor-slice"
import {
  createVideoSlice,
  decideVideoEndAction,
  type VideoEndDecision,
  type VideoSlice,
} from "@/stores/broadcast/video-slice"
import {
  createThemeSlice,
  findThemeById,
  resolveOutputThemeId,
  resolveThemeIdForItem,
  type ThemeSlice,
} from "@/stores/broadcast/theme-slice"
import {
  recordWorkflowTrace,
  tracePresentationDetails,
} from "@/lib/workflow-trace"
export {
  buildBroadcastHydrationPatch,
  hydrateBroadcastThemes,
  selectActiveTheme,
  selectAltActiveTheme,
} from "@/stores/broadcast/persistence"

type BroadcastSyncOptions = { transitionType?: BroadcastTransitionType }
type BroadcastUpdatePayload = {
  theme: BroadcastTheme
  item: PresentationRenderData | null
  opacity: number
  transition?: BroadcastTransition
}

export interface BroadcastState
  extends OutputIssueSlice,
    DesignerSlice,
    MonitorSlice,
    VideoSlice,
    ThemeSlice {
  isLive: boolean
  previewItem: PresentationRenderData | null
  liveItem: PresentationRenderData | null
  readingModeAutoLive: boolean
  liveTransitionType: BroadcastTransitionType
  opacity: number

  setLive: (live: boolean, options?: BroadcastSyncOptions) => void
  setPreviewItem: (item: PresentationRenderData | null) => void
  setLiveItem: (item: PresentationRenderData | null) => void
  commitLiveItem: (
    item: PresentationRenderData,
    options?: { makeLive?: boolean; transitionType?: BroadcastTransitionType }
  ) => void
  setReadingModeAutoLive: (enabled: boolean) => void
  setLiveTransitionType: (type: BroadcastTransitionType) => void
  setOpacity: (opacity: number) => void
  syncBroadcastOutput: (options?: BroadcastSyncOptions) => void
  syncBroadcastOutputFor: (
    outputId: string,
    options?: BroadcastSyncOptions
  ) => void
}

export { selectLatestOutputIssue, findThemeById, resolveThemeIdForItem, resolveOutputThemeId }

/** Theme an in-app surface should use to render a specific item. */
export function useItemTheme(
  item: PresentationRenderData | null
): BroadcastTheme | null {
  return useBroadcastStore((s) =>
    findThemeById(
      s.themes,
      resolveThemeIdForItem(item, s.activeThemeId, s.hymnThemeId)
    )
  )
}

/// Fallback so an animated transition is never silently instant when a theme
/// (e.g. an older persisted/custom one) carries a 0ms or missing duration.
const DEFAULT_TRANSITION_DURATION_MS = 500

function transitionForTheme(
  theme: BroadcastTheme,
  type: BroadcastTransitionType
): BroadcastTransition {
  if (type === "none") {
    return { ...theme.transition, type, duration: 0 }
  }
  const themeDuration = theme.transition?.duration
  const duration =
    themeDuration && themeDuration > 0
      ? themeDuration
      : DEFAULT_TRANSITION_DURATION_MS
  return { ...theme.transition, type, duration }
}

function buildBroadcastPayload(
  state: BroadcastState,
  theme: BroadcastTheme,
  options?: BroadcastSyncOptions
): BroadcastUpdatePayload {
  const payload: BroadcastUpdatePayload = {
    theme,
    item: state.isLive ? state.liveItem : null,
    opacity: state.opacity,
  }
  if (options?.transitionType) {
    payload.transition = transitionForTheme(theme, options.transitionType)
  }
  return payload
}

export { decideVideoEndAction }
export type { VideoEndDecision }

export const useBroadcastStore = create<BroadcastState>()((set, get, store) => ({
  ...createOutputIssueSlice(set, get, store),
  ...createDesignerSlice(set, get, store),
  ...createMonitorSlice(set, get, store),
  ...createVideoSlice(set, get, store),
  ...createThemeSlice(set, get, store),
  isLive: false,
  previewItem: null,
  liveItem: null,
  readingModeAutoLive: true,
  liveTransitionType: "fade",
  opacity: 1,

  syncBroadcastOutputFor: (outputId: string, options) => {
    const s = get()
    const themeId = resolveOutputThemeId(s, outputId)
    const label = outputId === "alt" ? "broadcast-alt" : "broadcast"
    const theme = findThemeById(s.themes, themeId)
    if (!theme) return

    void emitTo(
      label,
      "broadcast:verse-update",
      buildBroadcastPayload(s, theme, options)
    ).then(
      () => {
        get().clearOutputIssueFor(
          outputId === "alt" ? "alt" : "main",
          "broadcast-sync"
        )
      },
      (error) => {
        console.warn(`[broadcast-store] sync emit to '${label}' failed`, error)
        get().reportOutputIssue({
          outputId: outputId === "alt" ? "alt" : "main",
          kind: "broadcast-sync",
          title: "Broadcast sync failed",
          description: `Could not sync live output to ${label}: ${String(error)}`,
        })
      }
    )
  },
  syncBroadcastOutput: (options) => {
    get().syncBroadcastOutputFor("main", options)
    get().syncBroadcastOutputFor("alt", options)
  },
  setLive: (isLive, options) => {
    const shouldStopVideo = !isLive && get().liveItem?.kind === "video"
    set({ isLive })
    recordWorkflowTrace(
      "live.state",
      isLive ? "Live screen shown" : "Live screen hidden",
      {
        isLive,
        live: tracePresentationDetails(get().liveItem),
      }
    )
    get().syncBroadcastOutput(isLive ? options : undefined)
    if (shouldStopVideo) get().sendVideoCommand({ type: "stop" })
  },
  setPreviewItem: (previewItem) => {
    set({ previewItem })
    recordWorkflowTrace("preview.state", "Preview state updated", {
      preview: tracePresentationDetails(previewItem),
    })
  },
  setLiveItem: (liveItem) => {
    set({ liveItem })
    recordWorkflowTrace("live.state", "Live item state updated", {
      isLive: get().isLive,
      live: tracePresentationDetails(liveItem),
    })
    get().syncBroadcastOutput()
  },
  commitLiveItem: (liveItem, options) => {
    const makeLive = options?.makeLive ?? true
    const previousWasVideo = get().liveItem?.kind === "video"
    const sinkId =
      liveItem.kind === "video" ? get().preferredAudioOutputDeviceId : ""
    if (sinkId) get().sendVideoCommand({ type: "setSinkId", sinkId })
    if (liveItem.kind === "video") {
      set(
        makeLive
          ? { liveItem, isLive: true, videoTransport: null }
          : { liveItem, videoTransport: null }
      )
    } else if (previousWasVideo) {
      set(
        makeLive
          ? { liveItem, isLive: true, videoTransport: null }
          : { liveItem, videoTransport: null }
      )
    } else {
      set(makeLive ? { liveItem, isLive: true } : { liveItem })
    }
    recordWorkflowTrace("live.state", "Live commit state applied", {
      makeLive,
      isLive: get().isLive,
      live: tracePresentationDetails(get().liveItem),
    })
    if (previousWasVideo && liveItem.kind !== "video") {
      get().sendVideoCommand({ type: "stop" })
    }
    get().syncBroadcastOutput({
      transitionType: options?.transitionType ?? get().liveTransitionType,
    })
    if (liveItem.kind === "video") {
      get().sendVideoCommand({ type: "load", item: liveItem })
    }
  },
  setReadingModeAutoLive: (readingModeAutoLive) => {
    set({ readingModeAutoLive })
  },
  setLiveTransitionType: (liveTransitionType) => {
    set({ liveTransitionType })
  },
  setOpacity: (opacity) => {
    const nextOpacity = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1
    set({ opacity: nextOpacity })
    get().syncBroadcastOutput()
  },
}))
