// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockSave = vi.fn()
const mockIsTauriRuntime = vi.fn(() => true)

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => mockIsTauriRuntime(),
}))

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
    save: mockSave,
  })),
}))

describe("device-id", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    window.localStorage.clear()
    mockIsTauriRuntime.mockReset()
    mockIsTauriRuntime.mockReturnValue(true)
    mockGet.mockReset()
    mockSet.mockReset()
    mockSave.mockReset()
    const { resetDeviceIdStoreForTests } =
      await import("@/lib/verification/device-id")
    resetDeviceIdStoreForTests()
  })

  it("returns an existing device id from verification.json", async () => {
    mockGet.mockResolvedValue("existing-device-id")

    const { getOrCreateDeviceId } = await import("@/lib/verification/device-id")
    const deviceId = await getOrCreateDeviceId()

    expect(deviceId).toBe("existing-device-id")
    expect(mockSet).not.toHaveBeenCalled()
  })

  it("creates and persists a new device id when none exists", async () => {
    mockGet.mockResolvedValue(null)
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-2222-4333-8444-555555555555"
    )

    const { getOrCreateDeviceId } = await import("@/lib/verification/device-id")
    const deviceId = await getOrCreateDeviceId()

    expect(deviceId).toBe("11111111-2222-4333-8444-555555555555")
    expect(mockSet).toHaveBeenCalledWith(
      "deviceId",
      "11111111-2222-4333-8444-555555555555"
    )
    expect(mockSave).toHaveBeenCalled()
  })

  it("creates a new device id when the stored value is blank", async () => {
    mockGet.mockResolvedValue("   ")
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    )

    const { getOrCreateDeviceId } = await import("@/lib/verification/device-id")
    const deviceId = await getOrCreateDeviceId()

    expect(deviceId).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")
    expect(mockSet).toHaveBeenCalledWith(
      "deviceId",
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    )
  })

  it("uses a stable browser device id outside the desktop runtime", async () => {
    mockIsTauriRuntime.mockReturnValue(false)
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
    )

    const { getOrCreateDeviceId } = await import("@/lib/verification/device-id")
    const firstDeviceId = await getOrCreateDeviceId()
    const secondDeviceId = await getOrCreateDeviceId()

    expect(firstDeviceId).toBe("bbbbbbbb-cccc-4ddd-8eee-ffffffffffff")
    expect(secondDeviceId).toBe(firstDeviceId)
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
