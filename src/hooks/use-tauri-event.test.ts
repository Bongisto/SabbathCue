// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

let resolveListen: ((unlisten: () => void) => void) | undefined
const listenMock = vi.fn<
  (
    event: string,
    handler: (event: { payload: unknown }) => void
  ) => Promise<() => void>
>((event, handler) => {
  void event
  void handler
  return new Promise<() => void>((resolve) => {
    resolveListen = resolve
  })
})

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) =>
    listenMock(event, handler),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

describe("useTauriEvent", () => {
  beforeEach(() => {
    vi.resetModules()
    listenMock.mockClear()
    resolveListen = undefined
  })

  it("disposes the listener when registration resolves after unmount", async () => {
    const dispose = vi.fn()
    const { useTauriEvent } = await import("@/hooks/use-tauri-event")

    const { unmount } = renderHook(() =>
      useTauriEvent<string>("delayed-event", vi.fn())
    )

    expect(listenMock).toHaveBeenCalledTimes(1)
    unmount()

    await act(async () => {
      resolveListen?.(dispose)
      await Promise.resolve()
    })

    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
