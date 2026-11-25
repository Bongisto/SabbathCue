import { beforeEach, describe, expect, it, vi } from "vitest"

const mockLoad = vi.fn()
const mockGet = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
  invokeTauri: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-store", () => ({
  load: (...args: unknown[]) => mockLoad(...args),
}))

describe("session-storage", () => {
  beforeEach(async () => {
    vi.resetModules()
    mockLoad.mockReset()
    mockGet.mockReset()
    const { resetSessionStorageForTests } =
      await import("@/lib/verification/session-storage")
    resetSessionStorageForTests()
  })

  it("retries loading the store after a transient store load failure", async () => {
    mockLoad
      .mockRejectedValueOnce(new Error("store busy"))
      .mockResolvedValueOnce({
        get: mockGet.mockResolvedValue(null),
        set: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      })

    const { getSessionMetadata } =
      await import("@/lib/verification/session-storage")

    await expect(getSessionMetadata()).rejects.toThrow("store busy")
    await expect(getSessionMetadata()).resolves.toBeNull()
    expect(mockLoad).toHaveBeenCalledTimes(2)
  })
})
