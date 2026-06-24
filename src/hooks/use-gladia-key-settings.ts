import { invokeTauri } from "@/lib/tauri-runtime"
import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/hooks/use-deepgram-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

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

  const keySettings = useApiKeySettings({
    hasKey: hasGladiaApiKey,
    setHasKey: setHasGladiaApiKey,
    save: saveGladiaApiKey,
    clear: clearGladiaApiKey,
    onSaved: restartActiveTranscriptionIfNeeded,
  })

  return {
    hasGladiaApiKey,
    ...keySettings,
    handleProviderChange,
  }
}
