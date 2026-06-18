import { load, type Store } from "@tauri-apps/plugin-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import type { LibraryAsset, LibraryCollection } from "@/types/library"

export interface LibraryStateSnapshot {
  assets: LibraryAsset[]
  collections: LibraryCollection[]
}

const EMPTY_LIBRARY: LibraryStateSnapshot = {
  assets: [],
  collections: [],
}

let storePromise: Promise<Store> | null = null

function libraryStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("library.json", { autoSave: false, defaults: {} })
  }
  return storePromise
}

export async function loadLibrarySnapshot(): Promise<LibraryStateSnapshot> {
  if (!isTauriRuntime()) return EMPTY_LIBRARY

  const store = await libraryStore()
  const assets = await store.get<LibraryAsset[]>("assets")
  const collections = await store.get<LibraryCollection[]>("collections")
  return {
    assets: Array.isArray(assets) ? assets : [],
    collections: Array.isArray(collections) ? collections : [],
  }
}

export async function saveLibrarySnapshot(
  snapshot: LibraryStateSnapshot,
): Promise<void> {
  if (!isTauriRuntime()) return

  const store = await libraryStore()
  await store.set("assets", snapshot.assets)
  await store.set("collections", snapshot.collections)
  await store.save()
}
