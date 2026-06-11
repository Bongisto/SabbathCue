// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockToastInfo = vi.fn()
const mockHydrateSeenIds = vi.fn()
const mockFetchAnnouncements = vi.fn()
const mockMarkSeen = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

vi.mock("@/stores/announcements-store", () => ({
  useAnnouncementsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isHydrated: true,
      announcements: [
        { id: "a1", title: "Welcome", body: "New feature", published_at: null, expires_at: null },
      ],
      seenIds: new Set<string>(),
      hydrateSeenIds: mockHydrateSeenIds,
      fetchAnnouncements: mockFetchAnnouncements,
      markSeen: mockMarkSeen,
    }),
}))

vi.mock("@/stores/verification-store", () => ({
  useVerificationStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ status: "verified" }),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

describe("useAnnouncements", () => {
  beforeEach(() => {
    vi.resetModules()
    mockToastInfo.mockReset()
    mockHydrateSeenIds.mockReset()
    mockFetchAnnouncements.mockReset()
    mockMarkSeen.mockReset()
    mockHydrateSeenIds.mockResolvedValue(undefined)
    mockFetchAnnouncements.mockResolvedValue(undefined)
  })

  it("hydrates, fetches, and surfaces unseen announcements", async () => {
    const { useAnnouncements } = await import("@/hooks/use-announcements")
    renderHook(() => useAnnouncements())

    await waitFor(() => {
      expect(mockHydrateSeenIds).toHaveBeenCalled()
      expect(mockFetchAnnouncements).toHaveBeenCalled()
      expect(mockToastInfo).toHaveBeenCalledWith(
        "Welcome",
        expect.objectContaining({
          description: "New feature",
        }),
      )
    })
  })
})
