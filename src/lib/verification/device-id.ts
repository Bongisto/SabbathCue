import { load, type Store } from "@tauri-apps/plugin-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"

const STORE_FILE = "verification.json"
const DEVICE_ID_KEY = "deviceId"
const BROWSER_DEVICE_ID_KEY = "sabbathcue.browserDeviceId"

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: false, defaults: {} })
  return storePromise
}

export function resetDeviceIdStoreForTests(): void {
  storePromise = null
}

function createDeviceId(): string {
  return crypto.randomUUID()
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getOrCreateBrowserDeviceId(): string {
  const storage = getBrowserStorage()
  let existing: string | null = null
  try {
    existing = storage?.getItem(BROWSER_DEVICE_ID_KEY) ?? null
  } catch {
    existing = null
  }

  if (existing?.trim()) return existing

  const deviceId = createDeviceId()
  try {
    storage?.setItem(BROWSER_DEVICE_ID_KEY, deviceId)
  } catch {
    // Browser dev can still complete the current auth attempt without persistence.
  }
  return deviceId
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (!isTauriRuntime()) {
    return getOrCreateBrowserDeviceId()
  }

  const store = await getStore()
  const existing = await store.get<string>(DEVICE_ID_KEY)
  if (typeof existing === "string" && existing.trim() !== "") {
    return existing
  }

  const deviceId = createDeviceId()
  await store.set(DEVICE_ID_KEY, deviceId)
  await store.save()
  return deviceId
}
