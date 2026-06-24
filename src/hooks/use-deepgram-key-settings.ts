import { useCallback, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import { transcriptionActions } from "@/hooks/use-transcription"
import { useSettingsStore, type SttProvider } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"

const STT_RESTART_DELAY_MS = 350
export type ProviderChangeHandler = (provider: SttProvider) => void

export async function saveDeepgramApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  try {
    await invokeTauri("set_deepgram_api_key", { apiKey })
    const hasKey = await invokeTauri<boolean>("has_deepgram_api_key")
    if (!hasKey) {
      return { hasKey: false, error: "Deepgram API key was not saved" }
    }
    return { hasKey: true }
  } catch (e) {
    return { hasKey: false, error: String(e) }
  }
}

export async function clearDeepgramApiKey(): Promise<{ error?: string }> {
  try {
    await invokeTauri("clear_deepgram_api_key")
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function restartActiveTranscriptionIfNeeded(): Promise<void> {
  if (!useTranscriptStore.getState().isTranscribing) return

  await transcriptionActions.stop()
  await new Promise((resolve) => setTimeout(resolve, STT_RESTART_DELAY_MS))
  await transcriptionActions.start()
}

export function useDeepgramKeySettings() {
  const {
    sttProvider,
    setSttProvider,
    hasDeepgramApiKey,
    setHasDeepgramApiKey,
  } = useSettingsStore()

  const [switchingStt, setSwitchingStt] = useState(false)

  const keySettings = useApiKeySettings({
    hasKey: hasDeepgramApiKey,
    setHasKey: setHasDeepgramApiKey,
    save: saveDeepgramApiKey,
    clear: clearDeepgramApiKey,
  })

  const restartActiveTranscription = useCallback(async () => {
    setSwitchingStt(true)
    try {
      await restartActiveTranscriptionIfNeeded()
    } finally {
      setSwitchingStt(false)
    }
  }, [])

  const handleProviderChange = useCallback(
    (provider: SttProvider) => {
      if (provider === sttProvider || switchingStt) return
      setSttProvider(provider)
      void restartActiveTranscription()
    },
    [restartActiveTranscription, setSttProvider, sttProvider, switchingStt]
  )

  return {
    sttProvider,
    hasDeepgramApiKey,
    ...keySettings,
    switchingStt,
    handleProviderChange,
  }
}
