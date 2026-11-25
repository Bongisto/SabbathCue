import { create } from "zustand"
import type { SttProvider } from "@/stores/settings-store"

const PROVIDER_LABELS: Record<SttProvider, string> = {
  deepgram: "Deepgram",
  soniox: "Soniox",
  speechmatics: "Speechmatics",
  vosk: "Deepgram",
}

export function formatApiKeyPromptCopy(provider: SttProvider): {
  service: string
  description: string
} {
  const service = PROVIDER_LABELS[provider] ?? "Deepgram"
  return {
    service,
    description: `Live transcription needs a ${service} API key. Add it in settings so the app can start listening.`,
  }
}

interface ApiKeyPromptState {
  isOpen: boolean
  provider: SttProvider
  open: (provider?: SttProvider) => void
  setOpen: (isOpen: boolean) => void
}

export const useApiKeyPromptStore = create<ApiKeyPromptState>((set) => ({
  isOpen: false,
  provider: "deepgram",
  open: (provider = "deepgram") => set({ isOpen: true, provider }),
  setOpen: (isOpen) => set({ isOpen }),
}))

export function openApiKeyPrompt(provider?: SttProvider): void {
  useApiKeyPromptStore.getState().open(provider)
}
