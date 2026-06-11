import { create } from "zustand"
import { load, type Store } from "@tauri-apps/plugin-store"
import { fetchActiveAnnouncements, type ActiveAnnouncement } from "@/lib/supabase/announcements"
import { isTauriRuntime } from "@/lib/tauri-runtime"

const STORE_FILE = "announcements.json"
const SEEN_IDS_KEY = "seenAnnouncementIds"

interface AnnouncementsStore {
  announcements: ActiveAnnouncement[]
  seenIds: Set<string>
  isHydrated: boolean
  hydrateSeenIds: () => Promise<void>
  fetchAnnouncements: () => Promise<void>
  markSeen: (id: string) => Promise<void>
  unseenAnnouncements: () => ActiveAnnouncement[]
}

let storePromise: Promise<Store> | null = null

async function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

function parseSeenIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(value.filter((item): item is string => typeof item === "string"))
}

export const useAnnouncementsStore = create<AnnouncementsStore>((set, get) => ({
  announcements: [],
  seenIds: new Set(),
  isHydrated: false,

  hydrateSeenIds: async () => {
    if (!isTauriRuntime()) {
      set({ isHydrated: true })
      return
    }

    try {
      const store = await getStore()
      const seenIds = parseSeenIds(await store.get(SEEN_IDS_KEY))
      set({ seenIds, isHydrated: true })
    } catch {
      set({ isHydrated: true })
    }
  },

  fetchAnnouncements: async () => {
    const result = await fetchActiveAnnouncements()
    if (result.ok) {
      set({ announcements: result.announcements })
    }
  },

  markSeen: async (id) => {
    const nextSeen = new Set(get().seenIds)
    nextSeen.add(id)
    set({ seenIds: nextSeen })

    if (!isTauriRuntime()) return

    try {
      const store = await getStore()
      await store.set(SEEN_IDS_KEY, [...nextSeen])
      await store.save()
    } catch {
      console.warn("[announcements] Failed to persist seen id")
    }
  },

  unseenAnnouncements: () => {
    const { announcements, seenIds } = get()
    return announcements.filter((item) => !seenIds.has(item.id))
  },
}))

/** Test-only reset for store singleton and zustand state. */
export function resetAnnouncementsStoreForTests(): void {
  storePromise = null
  useAnnouncementsStore.setState({
    announcements: [],
    seenIds: new Set(),
    isHydrated: false,
  })
}
