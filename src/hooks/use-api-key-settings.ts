import { useCallback, useState } from "react"

const SAVED_KEY_DISPLAY = "Saved in secure keychain"

export interface ApiKeySettingsConfig {
  hasKey: boolean
  setHasKey: (value: boolean) => void
  save: (apiKey: string) => Promise<{ hasKey: boolean; error?: string }>
  clear: () => Promise<{ error?: string }>
  /** Optional side effect after a successful save (e.g. restart active STT). */
  onSaved?: () => Promise<void> | void
}

export function useApiKeySettings({
  hasKey,
  setHasKey,
  save,
  clear,
  onSaved,
}: ApiKeySettingsConfig) {
  const [keyValue, setKeyValue] = useState("")
  const [editingSavedKey, setEditingSavedKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const displayedKeyValue =
    hasKey && !editingSavedKey && !keyValue ? SAVED_KEY_DISPLAY : keyValue
  const keyActionLabel = hasKey ? "Update" : "Save"

  const handleSaveKey = useCallback(async () => {
    setKeyError(null)
    const result = await save(keyValue)
    setHasKey(result.hasKey)
    if (result.error) {
      setKeyError(result.error)
      return
    }
    if (result.hasKey) {
      setKeyValue("")
      setEditingSavedKey(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await onSaved?.()
    }
  }, [keyValue, save, setHasKey, onSaved])

  const handleKeyAction = useCallback(async () => {
    if (hasKey && !editingSavedKey && !keyValue) {
      setEditingSavedKey(true)
      return
    }
    await handleSaveKey()
  }, [editingSavedKey, handleSaveKey, hasKey, keyValue])

  const handleClearKey = useCallback(async () => {
    setKeyError(null)
    const result = await clear()
    if (result.error) {
      setKeyError(result.error)
      return
    }
    setHasKey(false)
    setKeyValue("")
    setEditingSavedKey(false)
  }, [clear, setHasKey])

  return {
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
  }
}
