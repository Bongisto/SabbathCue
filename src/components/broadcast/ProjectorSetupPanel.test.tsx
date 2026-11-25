// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectorSetupPanel } from "./ProjectorSetupPanel"

const testData = vi.hoisted(() => ({
  projectorMonitor: {
    key: "HDMI Projector|1920x1080|1920,0",
    name: "HDMI Projector",
    width: 1920,
    height: 1080,
    x: 1920,
    y: 0,
  },
  secondMonitor: {
    key: "Built-in|1920x1080|0,0",
    name: "Built-in",
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
  },
}))

const mocks = vi.hoisted(() => ({
  useBroadcastOutputSettings: vi.fn(),
  setOpen: vi.fn(),
  handleMonitorChange: vi.fn(),
  handleProjectorFullscreenChange: vi.fn(),
  handleToggleEnabled: vi.fn(),
}))

const projectorSetupState = vi.hoisted(() => ({
  open: true,
  monitors: [testData.projectorMonitor],
  setOpen: mocks.setOpen,
}))

const monitorState = vi.hoisted(() => ({
  mainDisplayMonitorKey: testData.projectorMonitor.key,
  mainProjectorFullscreen: true,
}))

vi.mock("@/hooks/use-broadcast-output-settings", () => ({
  useBroadcastOutputSettings: mocks.useBroadcastOutputSettings,
}))

vi.mock("@/stores/projector-setup-store", () => ({
  useProjectorSetupStore: (selector: (state: typeof projectorSetupState) => unknown) =>
    selector(projectorSetupState),
}))

vi.mock("@/stores/broadcast/monitor-store", () => ({
  useBroadcastMonitorStore: (selector: (state: typeof monitorState) => unknown) =>
    selector(monitorState),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <div>
      <button
        type="button"
        data-testid="mock-select-second-monitor"
        onClick={() => onValueChange?.(testData.secondMonitor.key)}
      >
        Select monitor
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}))

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      aria-label="switch"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      type="checkbox"
    />
  ),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: vi.fn(),
}))

function makeModel(
  projectorFullscreen: boolean,
  selectedMonitor = testData.projectorMonitor.key,
) {
  return {
    enabled: false,
    enabledPending: false,
    selectedMonitor,
    projectorFullscreen,
    handleMonitorChange: mocks.handleMonitorChange,
    handleProjectorFullscreenChange: mocks.handleProjectorFullscreenChange,
    handleToggleEnabled: mocks.handleToggleEnabled,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  projectorSetupState.open = true
  projectorSetupState.monitors = [testData.projectorMonitor]
})

afterEach(() => cleanup())

describe("ProjectorSetupPanel", () => {
  it("waits for fullscreen changes to reach the model before going live", async () => {
    let model = makeModel(false)
    mocks.useBroadcastOutputSettings.mockImplementation(() => model)

    const view = render(<ProjectorSetupPanel />)

    fireEvent.click(
      screen.getByRole("button", { name: /go live on the projector/i }),
    )

    expect(mocks.handleProjectorFullscreenChange).toHaveBeenCalledWith(true)
    expect(mocks.handleToggleEnabled).not.toHaveBeenCalled()

    model = makeModel(true)
    view.rerender(<ProjectorSetupPanel />)

    await waitFor(() => {
      expect(mocks.handleToggleEnabled).toHaveBeenCalledWith(true)
    })
  })

  it("clears pendingEnableRef when dialog closes so later updates do not auto-go-live (FU-53)", async () => {
    let model = makeModel(false)
    mocks.useBroadcastOutputSettings.mockImplementation(() => model)

    const view = render(<ProjectorSetupPanel />)
    fireEvent.click(
      screen.getByRole("button", { name: /go live on the projector/i }),
    )
    expect(mocks.handleToggleEnabled).not.toHaveBeenCalled()

    // Dialog closes while pending enable was still waiting.
    projectorSetupState.open = false
    model = makeModel(true)
    view.rerender(<ProjectorSetupPanel />)
    expect(mocks.handleToggleEnabled).not.toHaveBeenCalled()

    // Reopen later with matching target — must NOT auto-enable from stale pending ref.
    projectorSetupState.open = true
    view.rerender(<ProjectorSetupPanel />)
    await Promise.resolve()
    expect(mocks.handleToggleEnabled).not.toHaveBeenCalled()
  })

  it("clears pendingEnableRef on manual monitor or fullscreen changes (FU-53)", async () => {
    let model = makeModel(false)
    mocks.useBroadcastOutputSettings.mockImplementation(() => model)

    const view = render(<ProjectorSetupPanel />)
    fireEvent.click(
      screen.getByRole("button", { name: /go live on the projector/i }),
    )

    // Manual monitor change cancels pending auto-enable.
    fireEvent.click(screen.getByTestId("mock-select-second-monitor"))
    expect(mocks.handleMonitorChange).toHaveBeenCalledWith(testData.secondMonitor.key)

    model = makeModel(true)
    view.rerender(<ProjectorSetupPanel />)
    await Promise.resolve()
    expect(mocks.handleToggleEnabled).not.toHaveBeenCalled()
  })
})
