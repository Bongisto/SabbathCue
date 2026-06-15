import { useCallback, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import {
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/hooks/use-deepgram-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

const SAVED_KEY_DISPLAY = "Saved in secure keychain"

export async function saveGladiaApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  try {
    await invokeTauri("set_gladia_api_key", { apiKey })
    const hasKey = await invokeTauri<boolean>("has_gladia_api_key")
    if (!hasKey) {
      return { hasKey: false, error: "Gladia API key was not saved" }
    }
    return { hasKey: true }
  } catch (e) {
    return { hasKey: false, error: String(e) }
  }
}

export async function clearGladiaApiKey(): Promise<{ error?: string }> {
  try {
    await invokeTauri("clear_gladia_api_key")
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export function useGladiaKeySettings(
  handleProviderChange: ProviderChangeHandler
) {
  const { hasGladiaApiKey, setHasGladiaApiKey } = useSettingsStore()

  const [keyValue, setKeyValue] = useState("")
  const [editingSavedKey, setEditingSavedKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const displayedKeyValue =
    hasGladiaApiKey && !editingSavedKey && !keyValue
      ? SAVED_KEY_DISPLAY
      : keyValue
  const keyActionLabel = hasGladiaApiKey ? "Update" : "Save"

  const handleSaveKey = useCallback(async () => {
    setKeyError(null)
    const result = await saveGladiaApiKey(keyValue)
    setHasGladiaApiKey(result.hasKey)
    if (result.error) {
      setKeyError(result.error)
      return
    }
    if (result.hasKey) {
      setKeyValue("")
      setEditingSavedKey(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await restartActiveTranscriptionIfNeeded()
    }
  }, [keyValue, setHasGladiaApiKey])

  const handleKeyAction = useCallback(async () => {
    if (hasGladiaApiKey && !editingSavedKey && !keyValue) {
      setEditingSavedKey(true)
      return
    }
    await handleSaveKey()
  }, [editingSavedKey, handleSaveKey, hasGladiaApiKey, keyValue])

  const handleClearKey = useCallback(async () => {
    setKeyError(null)
    const result = await clearGladiaApiKey()
    if (result.error) {
      setKeyError(result.error)
      return
    }
    setHasGladiaApiKey(false)
    setKeyValue("")
    setEditingSavedKey(false)
  }, [setHasGladiaApiKey])

  return {
    hasGladiaApiKey,
    keyValue,
    setKeyValue,
    editingSavedKey,
    setEditingSavedKey,
    saved,
    keyError,
    displayedKeyValue,
    keyActionLabel,
    handleKeyAction,
    handleClearKey,
    handleProviderChange,
  }
}
