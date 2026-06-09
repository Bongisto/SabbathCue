import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { emitTo } from "@tauri-apps/api/event"
import { getAllWindows } from "@tauri-apps/api/window"
import {
  buildOpenBroadcastWindowArgs,
  type BroadcastOutputId,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import {
  buildNdiConfigPayload,
  buildNdiStartRequest,
  getBroadcastWindowLabel,
  getDefaultOutputSettings,
  type BroadcastOutputType,
} from "@/lib/broadcast-output-settings"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { NdiAlphaMode, NdiFrameRate, NdiResolution, NdiSessionInfo } from "@/types"
import { toast } from "sonner"

export type { MonitorInfo }

export interface UseBroadcastOutputSettingsOptions {
  open: boolean
  ndiSdkInstalled: boolean
  monitors: MonitorInfo[]
}

interface NdiStatusResponse {
  active: boolean
  width: number
  height: number
  fps: number
}

function showBroadcastError(title: string, error: unknown) {
  toast.error(title, { description: String(error) })
}

function mapNdiResolution(width: number, height: number): NdiResolution | null {
  if (width === 3840 && height === 2160) return "r4k"
  if (width === 1920 && height === 1080) return "r1080p"
  if (width === 1280 && height === 720) return "r720p"
  return null
}

function mapNdiFrameRate(fps: number): NdiFrameRate | null {
  if (fps === 24) return "fps24"
  if (fps === 30) return "fps30"
  if (fps === 60) return "fps60"
  return null
}

export async function reconcileBroadcastPreviewState(
  outputId: BroadcastOutputId,
): Promise<boolean> {
  const label = getBroadcastWindowLabel(outputId)
  const windows = await getAllWindows()
  return windows.some((w) => w.label === label)
}

export interface BroadcastOutputCommandState {
  outputId: BroadcastOutputId
  isPreviewOpen: boolean
  selectedMonitor: string
  monitors: MonitorInfo[]
  fallbackMonitorIndex: number
  projectorFullscreen: boolean
  ndiActive: boolean
  ndiSourceName: string
  ndiResolution: NdiResolution
  ndiFrameRate: NdiFrameRate
  ndiAlphaMode: NdiAlphaMode
  ndiSdkInstalled: boolean
}

export async function runToggleBroadcastPreview(
  state: BroadcastOutputCommandState,
  deps: {
    invoke: typeof invokeTauri
    syncBroadcastOutputFor: (outputId: string) => void
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    onPreviewOpenChange: (open: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const {
    outputId,
    isPreviewOpen,
    selectedMonitor,
    monitors,
    fallbackMonitorIndex,
    projectorFullscreen,
    ndiActive,
    ndiFrameRate,
    ndiResolution,
  } = state

  try {
    if (isPreviewOpen) {
      await deps.invoke("close_broadcast_window", { outputId })
      deps.onPreviewOpenChange(await reconcileBroadcastPreviewState(outputId))
    } else {
      await deps.invoke("open_broadcast_window", {
        ...buildOpenBroadcastWindowArgs(
          outputId,
          monitors,
          selectedMonitor,
          fallbackMonitorIndex,
          projectorFullscreen,
        ),
      })
      const opened = await reconcileBroadcastPreviewState(outputId)
      deps.onPreviewOpenChange(opened)
      if (!opened) return
      deps.syncBroadcastOutputFor(outputId)
      deps.emitNdiConfig(ndiActive, ndiFrameRate, ndiResolution)
      setTimeout(() => {
        deps.syncBroadcastOutputFor(outputId)
      }, 150)
    }
  } catch (error) {
    deps.onError(
      outputId === "alt" ? "Could not toggle alternate preview" : "Could not toggle broadcast preview",
      error,
    )
  }
}

export async function runToggleBroadcastNdi(
  state: BroadcastOutputCommandState,
  deps: {
    invoke: typeof invokeTauri
    syncBroadcastOutputFor: (outputId: string) => void
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    emitPostStartNdiConfig: (session: NdiSessionInfo) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
    onNdiSdkMissing: () => void
  },
): Promise<void> {
  const {
    outputId,
    isPreviewOpen,
    ndiActive,
    ndiSdkInstalled,
    ndiSourceName,
    ndiResolution,
    ndiFrameRate,
    ndiAlphaMode,
  } = state

  try {
    if (!ndiActive && !ndiSdkInstalled) {
      deps.onNdiSdkMissing()
      return
    }

    const windowLabel = getBroadcastWindowLabel(outputId)

    if (ndiActive) {
      await deps.invoke("stop_ndi", { outputId })
      deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
      deps.onNdiActiveChange(false)
      if (!isPreviewOpen) {
        await deps.invoke("close_broadcast_window", { outputId }).catch((error) =>
          console.warn(
            `[broadcast-settings] close ${outputId} window after NDI stop failed`,
            error,
          ),
        )
      }
    } else {
      await deps.invoke("ensure_broadcast_window", { outputId })
      const request = buildNdiStartRequest(
        ndiSourceName,
        ndiResolution,
        ndiFrameRate,
        ndiAlphaMode,
      )
      const session = await deps.invoke<NdiSessionInfo>("start_ndi", { outputId, request })
      deps.onNdiActiveChange(true)
      deps.syncBroadcastOutputFor(outputId)
      void emitTo(windowLabel, "broadcast:ndi-config", {
        active: true,
        fps: session.fps,
        width: session.width,
        height: session.height,
      }).catch((error) =>
        console.warn(
          `[broadcast-settings] emit post-start sync (${outputId}) failed`,
          error,
        ),
      )
      setTimeout(() => {
        deps.syncBroadcastOutputFor(outputId)
        deps.emitNdiConfig(true, ndiFrameRate, ndiResolution)
      }, 300)
    }
  } catch (error) {
    deps.onError(
      outputId === "alt" ? "Could not toggle alternate NDI output" : "Could not toggle NDI output",
      error,
    )
  }
}

export async function runDisableBroadcastOutput(
  state: Pick<
    BroadcastOutputCommandState,
    "outputId" | "isPreviewOpen" | "ndiActive" | "ndiFrameRate" | "ndiResolution"
  >,
  deps: {
    invoke: typeof invokeTauri
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    onPreviewOpenChange: (open: boolean) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const { outputId, isPreviewOpen, ndiActive, ndiFrameRate, ndiResolution } = state

  if (isPreviewOpen) {
    try {
      await deps.invoke("close_broadcast_window", { outputId })
    } catch (error) {
      deps.onError(
        outputId === "alt"
          ? "Could not close alternate broadcast preview"
          : "Could not close broadcast preview",
        error,
      )
    }
  }

  if (ndiActive) {
    try {
      await deps.invoke("stop_ndi", { outputId })
    } catch (error) {
      deps.onError(
        outputId === "alt" ? "Could not stop alternate NDI output" : "Could not stop NDI output",
        error,
      )
    }
    deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
  }

  const previewOpen = await reconcileBroadcastPreviewState(outputId)
  deps.onPreviewOpenChange(previewOpen)

  let ndiStillActive = false
  try {
    const status = await deps.invoke<NdiStatusResponse | null>("get_ndi_status", { outputId })
    ndiStillActive = Boolean(status?.active)
  } catch {
    ndiStillActive = false
  }
  deps.onNdiActiveChange(ndiStillActive)
}

export function useBroadcastOutputSettings(
  outputId: BroadcastOutputId,
  options: UseBroadcastOutputSettingsOptions,
) {
  const { open, ndiSdkInstalled, monitors } = options
  const defaults = getDefaultOutputSettings(outputId)

  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) =>
    outputId === "alt" ? s.altActiveThemeId : s.activeThemeId,
  )
  const displayMonitorIndex = useBroadcastStore((s) =>
    outputId === "alt" ? s.altDisplayMonitorIndex : s.mainDisplayMonitorIndex,
  )
  const displayMonitorKey = useBroadcastStore((s) =>
    outputId === "alt" ? s.altDisplayMonitorKey : s.mainDisplayMonitorKey,
  )
  const projectorFullscreen = useBroadcastStore((s) =>
    outputId === "alt" ? s.altProjectorFullscreen : s.mainProjectorFullscreen,
  )

  const [themeId, setThemeId] = useState(activeThemeId)
  const [outputType, setOutputType] = useState<BroadcastOutputType>(defaults.outputType)
  const [selectedMonitor, setSelectedMonitor] = useState(displayMonitorKey)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [ndiSourceName, setNdiSourceName] = useState(defaults.ndiSourceName)
  const [ndiResolution, setNdiResolution] = useState<NdiResolution>(defaults.ndiResolution)
  const [ndiFrameRate, setNdiFrameRate] = useState<NdiFrameRate>(defaults.ndiFrameRate)
  const [ndiAlphaMode, setNdiAlphaMode] = useState<NdiAlphaMode>(defaults.ndiAlphaMode)
  const [ndiActive, setNdiActive] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [ndiPending, setNdiPending] = useState(false)
  const [enabledPending, setEnabledPending] = useState(false)
  const previewPendingRef = useRef(false)
  const ndiPendingRef = useRef(false)
  const enabledPendingRef = useRef(false)

  const enabled = isPreviewOpen || ndiActive

  const syncNdiConfigToOutput = useCallback(
    (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => {
      const label = getBroadcastWindowLabel(outputId)
      const payload = buildNdiConfigPayload(active, frameRate, resolution)
      void emitTo(label, "broadcast:ndi-config", payload).catch((error) => {
        console.warn("[broadcast-settings] emit ndi-config failed", error)
        useBroadcastStore.getState().reportOutputIssue({
          outputId,
          kind: "ndi-config",
          title: "NDI config sync failed",
          description: `Could not sync NDI config to ${label}: ${String(error)}`,
        })
      })
    },
    [outputId],
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setThemeId(activeThemeId)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [activeThemeId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (displayMonitorKey) {
        setSelectedMonitor(displayMonitorKey)
        return
      }
      const fallbackMonitor = monitors[displayMonitorIndex]
      if (fallbackMonitor) {
        setSelectedMonitor(fallbackMonitor.key)
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [displayMonitorKey, displayMonitorIndex, monitors])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const reconcile = async () => {
      const previewOpen = await reconcileBroadcastPreviewState(outputId)
      if (!cancelled) setIsPreviewOpen(previewOpen)

      try {
        const status = await invokeTauri<NdiStatusResponse | null>("get_ndi_status", { outputId })
        if (cancelled) return
        if (status?.active) {
          setNdiActive(true)
          const mappedResolution = mapNdiResolution(status.width, status.height)
          const mappedFrameRate = mapNdiFrameRate(status.fps)
          if (mappedResolution) setNdiResolution(mappedResolution)
          if (mappedFrameRate) setNdiFrameRate(mappedFrameRate)
        } else {
          setNdiActive(false)
        }
      } catch {
        if (!cancelled) setNdiActive(false)
      }
    }

    void reconcile()
    return () => {
      cancelled = true
    }
  }, [open, outputId])

  useEffect(() => {
    if (!open || !isPreviewOpen) return

    const intervalId = setInterval(() => {
      void reconcileBroadcastPreviewState(outputId).then(setIsPreviewOpen)
    }, 750)

    return () => {
      clearInterval(intervalId)
    }
  }, [open, isPreviewOpen, outputId])

  const handleThemeChange = useCallback(
    (id: string) => {
      setThemeId(id)
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltActiveTheme(id)
      } else {
        useBroadcastStore.getState().setActiveTheme(id)
      }
    },
    [outputId],
  )

  const handleMonitorChange = useCallback(
    (value: string) => {
      setSelectedMonitor(value)
      const index = monitors.findIndex((monitor) => monitor.key === value)
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltDisplayMonitorKey(value)
        if (index >= 0) useBroadcastStore.getState().setAltDisplayMonitorIndex(index)
      } else {
        useBroadcastStore.getState().setMainDisplayMonitorKey(value)
        if (index >= 0) useBroadcastStore.getState().setMainDisplayMonitorIndex(index)
      }
    },
    [outputId, monitors],
  )

  const handleProjectorFullscreenChange = useCallback(
    (checked: boolean) => {
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltProjectorFullscreen(checked)
      } else {
        useBroadcastStore.getState().setMainProjectorFullscreen(checked)
      }
    },
    [outputId],
  )

  const buildCommandState = useCallback(
    (): BroadcastOutputCommandState => ({
      outputId,
      isPreviewOpen,
      selectedMonitor,
      monitors,
      fallbackMonitorIndex: displayMonitorIndex,
      projectorFullscreen,
      ndiActive,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiSdkInstalled,
    }),
    [
      outputId,
      isPreviewOpen,
      selectedMonitor,
      monitors,
      displayMonitorIndex,
      projectorFullscreen,
      ndiActive,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiSdkInstalled,
    ],
  )

  const buildCommandDeps = useCallback(
    () => ({
      invoke: invokeTauri,
      syncBroadcastOutputFor: useBroadcastStore.getState().syncBroadcastOutputFor,
      emitNdiConfig: syncNdiConfigToOutput,
      onPreviewOpenChange: setIsPreviewOpen,
      onNdiActiveChange: setNdiActive,
      onError: showBroadcastError,
      onNdiSdkMissing: () => {
        toast.error("NDI SDK is missing", {
          description: "Run bun run download:ndi-sdk, then refresh SDK status.",
        })
      },
      emitPostStartNdiConfig: () => {},
    }),
    [syncNdiConfigToOutput],
  )

  const handleTogglePreview = useCallback(async () => {
    if (previewPendingRef.current) return
    previewPendingRef.current = true
    setPreviewPending(true)
    try {
      await runToggleBroadcastPreview(buildCommandState(), buildCommandDeps())
    } finally {
      previewPendingRef.current = false
      setPreviewPending(false)
    }
  }, [buildCommandState, buildCommandDeps])

  const handleToggleNdi = useCallback(async () => {
    if (ndiPendingRef.current) return
    ndiPendingRef.current = true
    setNdiPending(true)
    try {
      await runToggleBroadcastNdi(buildCommandState(), buildCommandDeps())
    } finally {
      ndiPendingRef.current = false
      setNdiPending(false)
    }
  }, [buildCommandState, buildCommandDeps])

  const handleToggleEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (enabledPendingRef.current) return
      enabledPendingRef.current = true
      setEnabledPending(true)
      try {
        if (nextEnabled) {
          if (outputType === "display") {
            await handleTogglePreview()
          } else {
            await handleToggleNdi()
          }
          return
        }
        await runDisableBroadcastOutput(buildCommandState(), buildCommandDeps())
      } finally {
        enabledPendingRef.current = false
        setEnabledPending(false)
      }
    },
    [buildCommandState, buildCommandDeps, handleToggleNdi, handleTogglePreview, outputType],
  )

  return useMemo(
    () => ({
      outputId,
      enabled,
      themeId,
      themes,
      outputType,
      selectedMonitor,
      isPreviewOpen,
      projectorFullscreen,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiActive,
      previewPending,
      ndiPending,
      enabledPending,
      setOutputType,
      setNdiSourceName,
      setNdiResolution,
      setNdiFrameRate,
      setNdiAlphaMode,
      handleThemeChange,
      handleMonitorChange,
      handleProjectorFullscreenChange,
      handleTogglePreview,
      handleToggleNdi,
      handleToggleEnabled,
      syncNdiConfigToOutput,
    }),
    [
      outputId,
      enabled,
      themeId,
      themes,
      outputType,
      selectedMonitor,
      isPreviewOpen,
      projectorFullscreen,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiActive,
      previewPending,
      ndiPending,
      enabledPending,
      handleThemeChange,
      handleMonitorChange,
      handleProjectorFullscreenChange,
      handleTogglePreview,
      handleToggleNdi,
      handleToggleEnabled,
      syncNdiConfigToOutput,
    ],
  )
}

export type BroadcastOutputSettingsModel = ReturnType<typeof useBroadcastOutputSettings>
