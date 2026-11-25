import { beforeEach, describe, expect, it, vi } from "vitest"

const mockLoad = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

vi.mock("@tauri-apps/plugin-store", () => ({
  load: (...args: unknown[]) => mockLoad(...args),
}))

describe("library-persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    mockLoad.mockReset()
  })

  it("clears the cached storePromise on load failure so subsequent calls retry", async () => {
    mockLoad
      .mockRejectedValueOnce(new Error("disk locked"))
      .mockResolvedValueOnce({
        get: vi.fn().mockResolvedValue([]),
        set: vi.fn(),
        save: vi.fn(),
      })

    const { loadLibrarySnapshot } =
      await import("@/lib/library/library-persistence")

    await expect(loadLibrarySnapshot()).rejects.toThrow("disk locked")
    await expect(loadLibrarySnapshot()).resolves.toEqual({
      assets: [],
      collections: [],
    })
    expect(mockLoad).toHaveBeenCalledTimes(2)
  })
})
