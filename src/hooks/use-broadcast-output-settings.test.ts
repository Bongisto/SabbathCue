// @vitest-environment jsdom
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createRoot } from "react-dom/client"
import React from "react"
import type { NdiSessionInfo } from "@/types"
import type { BroadcastOutputCommandState } from "./use-broadcast-output-settings"

const mockInvoke = vi.fn()
const mockEmitTo = vi.fn()
const mockGetAllWindows = vi.fn()
const mockSyncBroadcastOutputFor = vi.fn()
const mockToastError = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => mockEmitTo(...args),
}))

vi.mock("@tauri-apps/api/window", () => ({
  getAllWindows: () => mockGetAllWindows(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const sampleMonitors = [
  {
    name: "HDMI-1",
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    key: "hdmi-1|1920x1080|0,0",
  },
  {
    name: "HDMI-2",
    width: 1280,
    height: 720,
    x: 1920,
    y: 0,
    key: "hdmi-2|1280x720|1920,0",
  },
]

function baseState(
  overrides: Partial<BroadcastOutputCommandState> = {},
): BroadcastOutputCommandState {
  return {
    outputId: "main",
    isPreviewOpen: false,
    selectedMonitor: sampleMonitors[1].key,
    monitors: sampleMonitors,
    fallbackMonitorIndex: 0,
    projectorFullscreen: false,
    ndiActive: false,
    ndiSourceName: "SabbathCue Output",
    ndiResolution: "r1080p",
    ndiFrameRate: "fps24",
    ndiAlphaMode: "straightAlpha",
    ndiSdkInstalled: true,
    ...overrides,
  }
}

function baseDeps() {
  return {
    invoke: mockInvoke,
    syncBroadcastOutputFor: mockSyncBroadcastOutputFor,
    emitNdiConfig: vi.fn(),
    onPreviewOpenChange: vi.fn(),
    onNdiActiveChange: vi.fn(),
    onError: vi.fn(),
    onNdiSdkMissing: vi.fn(),
    emitPostStartNdiConfig: vi.fn(),
  }
}

async function loadCommandModule() {
  vi.resetModules()
  return import("./use-broadcast-output-settings")
}

describe("use-broadcast-output-settings commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
    mockEmitTo.mockReset()
    mockGetAllWindows.mockReset()
    mockSyncBroadcastOutputFor.mockReset()
    mockToastError.mockReset()
    mockGetAllWindows.mockResolvedValue([])
    mockEmitTo.mockResolvedValue(undefined)
  })

  describe("runToggleBroadcastPreview", () => {
    it("opens preview with monitor args then syncs output", async () => {
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([{ label: "broadcast" }])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastPreview(
        baseState({
          projectorFullscreen: true,
          selectedMonitor: sampleMonitors[1].key,
        }),
        deps,
      )

      expect(mockInvoke).toHaveBeenCalledWith("open_broadcast_window", {
        outputId: "main",
        monitorIndex: 1,
        fullscreen: true,
      })
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(true)
      expect(mockSyncBroadcastOutputFor).toHaveBeenCalledWith("main")
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps24", "r1080p")
    })

    it("closes preview before reconciling window state", async () => {
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastPreview(baseState({ isPreviewOpen: true }), deps)

      expect(mockInvoke).toHaveBeenCalledWith("close_broadcast_window", { outputId: "main" })
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe("runToggleBroadcastNdi", () => {
    it("starts NDI after ensuring the broadcast window", async () => {
      const session: NdiSessionInfo = {
        sourceName: "SabbathCue Output",
        resolution: "r1080p",
        frameRate: "fps24",
        alphaMode: "straightAlpha",
        width: 1920,
        height: 1080,
        fps: 24,
      }
      mockInvoke.mockResolvedValue(session)

      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState(), deps)

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "ensure_broadcast_window",
        "start_ndi",
      ])
      expect(mockInvoke).toHaveBeenCalledWith("ensure_broadcast_window", { outputId: "main" })
      expect(mockInvoke).toHaveBeenCalledWith("start_ndi", {
        outputId: "main",
        request: {
          sourceName: "SabbathCue Output",
          resolution: "r1080p",
          frameRate: "fps24",
          alphaMode: "straightAlpha",
        },
      })
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(true)
      expect(mockEmitTo).toHaveBeenCalledWith("broadcast", "broadcast:ndi-config", {
        active: true,
        fps: 24,
        width: 1920,
        height: 1080,
      })
    })

    it("stops NDI and closes the window when preview is not open", async () => {
      mockInvoke.mockResolvedValue(undefined)

      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState({ ndiActive: true }), deps)

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "stop_ndi",
        "close_broadcast_window",
      ])
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps24", "r1080p")
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(false)
    })

    it("does not invoke NDI commands when the SDK is missing", async () => {
      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState({ ndiSdkInstalled: false }), deps)

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(deps.onNdiSdkMissing).toHaveBeenCalled()
    })
  })

  describe("runDisableBroadcastOutput", () => {
    it("stops preview and NDI in order when disabling output", async () => {
      mockInvoke.mockResolvedValue(undefined)

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const deps = baseDeps()

      await runDisableBroadcastOutput(
        {
          outputId: "alt",
          isPreviewOpen: true,
          ndiActive: true,
          ndiFrameRate: "fps30",
          ndiResolution: "r720p",
        },
        deps,
      )

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "close_broadcast_window",
        "stop_ndi",
        "get_ndi_status",
      ])
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps30", "r720p")
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(false)
    })

    it("reconciles preview and NDI state before reporting disabled", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") return { active: true, width: 1920, height: 1080, fps: 24 }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const onPreviewOpenChange = vi.fn()
      const onNdiActiveChange = vi.fn()

      await runDisableBroadcastOutput(
        {
          outputId: "main",
          isPreviewOpen: true,
          ndiActive: true,
          ndiFrameRate: "fps24",
          ndiResolution: "r1080p",
        },
        {
          ...baseDeps(),
          onPreviewOpenChange,
          onNdiActiveChange,
        },
      )

      expect(onPreviewOpenChange).toHaveBeenCalledWith(false)
      expect(onNdiActiveChange).toHaveBeenCalledWith(true)
    })
  })

  describe("useBroadcastOutputSettings hook", () => {
    async function renderHookResult(open = true) {
      const { useBroadcastOutputSettings } = await loadCommandModule()
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)
      const result: { current: ReturnType<typeof useBroadcastOutputSettings> | null } = {
        current: null,
      }

      function Probe() {
        result.current = useBroadcastOutputSettings("main", {
          open,
          ndiSdkInstalled: true,
          monitors: sampleMonitors,
        })
        return null
      }

      await act(async () => {
        root.render(React.createElement(Probe))
        await Promise.resolve()
        await Promise.resolve()
      })

      return {
        result,
        cleanup: () => {
          act(() => {
            root.unmount()
          })
          container.remove()
        },
      }
    }

    it("derives enabled from active NDI status when the dialog opens", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") {
          return { active: true, width: 1920, height: 1080, fps: 24 }
        }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      expect(result.current?.enabled).toBe(true)
      expect(result.current?.ndiActive).toBe(true)
      cleanup()
    })

    it("ignores duplicate NDI toggle calls while the first command is pending", async () => {
      let startCalls = 0
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "start_ndi") {
          startCalls += 1
          return {
            sourceName: "SabbathCue Output",
            resolution: "r1080p",
            frameRate: "fps24",
            alphaMode: "straightAlpha",
            width: 1920,
            height: 1080,
            fps: 24,
          }
        }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      const toggle = result.current?.handleToggleNdi
      expect(toggle).toBeDefined()

      await act(async () => {
        await Promise.all([toggle?.(), toggle?.()])
      })

      expect(startCalls).toBe(1)
      cleanup()
    })
  })
})
