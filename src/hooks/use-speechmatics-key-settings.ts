import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  createProviderKeyActions,
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/lib/stt-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

const speechmaticsKeyActions = createProviderKeyActions({
  label: "Speechmatics",
  setCommand: "set_speechmatics_api_key",
  hasCommand: "has_speechmatics_api_key",
  clearCommand: "clear_speechmatics_api_key",
  validateCommand: "validate_speechmatics_api_key",
})

export function useSpeechmaticsKeySettings(
  handleProviderChange: ProviderChangeHandler
) {
  const { hasSpeechmaticsApiKey, setHasSpeechmaticsApiKey } = useSettingsStore()
  const keySettings = useApiKeySettings({
    hasKey: hasSpeechmaticsApiKey,
    setHasKey: setHasSpeechmaticsApiKey,
    save: speechmaticsKeyActions.saveApiKey,
    clear: speechmaticsKeyActions.clearApiKey,
    validate: speechmaticsKeyActions.validateApiKey,
    onSaved: restartActiveTranscriptionIfNeeded,
  })

  return {
    hasSpeechmaticsApiKey,
    ...keySettings,
    handleProviderChange,
  }
}
