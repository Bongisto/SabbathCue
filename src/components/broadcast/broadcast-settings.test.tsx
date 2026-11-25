// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BroadcastSettings } from "./broadcast-settings"

const mocks = vi.hoisted(() => ({
  outputReadyHandler: null as (() => void) | null,
  syncMainNdiConfigToOutput: vi.fn(),
  syncAltNdiConfigToOutput: vi.fn(),
  invokeTauri: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => []),
}))

vi.mock("@/hooks/use-tauri-event", () => ({
  useTauriEvent: (event: string, handler: () => void) => {
    if (event === "broadcast:output-ready") {
      mocks.outputReadyHandler = handler
    }
  },
}))

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mocks.invokeTauri(...args),
}))

vi.mock("@/hooks/use-assets", () => ({
  useAssets: () => ({ status: { ndi_sdk: true } }),
}))

vi.mock("@/hooks/use-broadcast-output-settings", () => ({
  useBroadcastOutputSettings: (outputId: "main" | "alt") => ({
    outputId,
    syncNdiConfigToOutput:
      outputId === "main" ? mocks.syncMainNdiConfigToOutput : mocks.syncAltNdiConfigToOutput,
    ndiActive: true,
    ndiFrameRate: 30,
    ndiResolution: "1080p",
  }),
}))

vi.mock("@/components/broadcast/BroadcastOutputCard", () => ({
  BroadcastOutputCard: () => null,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.outputReadyHandler = null
})

afterEach(() => cleanup())

describe("BroadcastSettings (FU-51)", () => {
  it("syncs NDI config on broadcast:output-ready only when open without leaking timers", () => {
    const view = render(<BroadcastSettings open={false} onOpenChange={vi.fn()} />)

    mocks.outputReadyHandler?.()
    expect(mocks.syncMainNdiConfigToOutput).not.toHaveBeenCalled()
    expect(mocks.syncAltNdiConfigToOutput).not.toHaveBeenCalled()

    view.rerender(<BroadcastSettings open={true} onOpenChange={vi.fn()} />)
    mocks.outputReadyHandler?.()
    mocks.outputReadyHandler?.()

    expect(mocks.syncMainNdiConfigToOutput).toHaveBeenCalledTimes(2)
    expect(mocks.syncAltNdiConfigToOutput).toHaveBeenCalledTimes(2)
  })
})
