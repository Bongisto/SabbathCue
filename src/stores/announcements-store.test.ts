import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  resetAnnouncementsStoreForTests,
  useAnnouncementsStore,
} from "@/stores/announcements-store"

const mockLoad = vi.fn()
const mockFetchActive = vi.fn()

vi.mock("@tauri-apps/plugin-store", () => ({
  load: (...args: unknown[]) => mockLoad(...args),
}))

vi.mock("@/lib/supabase/announcements", () => ({
  fetchActiveAnnouncements: (...args: unknown[]) => mockFetchActive(...args),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

describe("announcements-store", () => {
  beforeEach(() => {
    resetAnnouncementsStoreForTests()
    mockLoad.mockReset()
    mockFetchActive.mockReset()
  })

  it("hydrates seen ids from the tauri store", async () => {
    mockLoad.mockResolvedValue({
      get: vi.fn().mockResolvedValue(["seen-1"]),
      set: vi.fn(),
      save: vi.fn(),
    })

    await useAnnouncementsStore.getState().hydrateSeenIds()

    expect(useAnnouncementsStore.getState().seenIds.has("seen-1")).toBe(true)
    expect(useAnnouncementsStore.getState().isHydrated).toBe(true)
  })

  it("filters unseen announcements", async () => {
    useAnnouncementsStore.setState({
      announcements: [
        { id: "a1", title: "One", body: "Body", published_at: null, expires_at: null },
        { id: "a2", title: "Two", body: "Body", published_at: null, expires_at: null },
      ],
      seenIds: new Set(["a1"]),
      isHydrated: true,
    })

    expect(useAnnouncementsStore.getState().unseenAnnouncements()).toEqual([
      { id: "a2", title: "Two", body: "Body", published_at: null, expires_at: null },
    ])
  })

  it("persists newly seen ids", async () => {
    const set = vi.fn()
    const save = vi.fn()
    mockLoad.mockResolvedValue({
      get: vi.fn().mockResolvedValue([]),
      set,
      save,
    })

    await useAnnouncementsStore.getState().hydrateSeenIds()
    await useAnnouncementsStore.getState().markSeen("a9")

    expect(set).toHaveBeenCalledWith("seenAnnouncementIds", ["a9"])
    expect(save).toHaveBeenCalled()
  })
})
