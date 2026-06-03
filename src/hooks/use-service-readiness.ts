import { useCallback } from "react"
import { useAssets } from "@/hooks/use-assets"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { commitPreviewToLive, selectPreviewVerse } from "@/lib/presentation-workflow"
import { bibleActions } from "@/hooks/use-bible"

export type ReadinessStatus = "ready" | "warning" | "unavailable"

export interface ReadinessCheck {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
  actionLabel?: string
  onAction?: () => void
}

export function useServiceReadiness() {
  const audioLevel = useAudioStore((s) => s.level)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const sttProvider = useSettingsStore((s) => s.sttProvider)
  const hasDeepgramApiKey = useSettingsStore((s) => s.hasDeepgramApiKey)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const { status: assetStatus, loading: assetsLoading } = useAssets()

  const sendTestVerse = useCallback(async () => {
    try {
      const verse = await bibleActions.fetchVerse(1, 1, 1)
      if (verse) {
        selectPreviewVerse(verse)
        commitPreviewToLive()
      }
    } catch (e) {
      console.error("[readiness] test verse failed", e)
    }
  }, [])

  const micHealthy = audioLevel.rms > 0.02 || isTranscribing
  const sttReady =
    sttProvider === "deepgram"
      ? hasDeepgramApiKey
      : !assetsLoading &&
        Boolean(assetStatus?.vosk_model && assetStatus?.vosk_worker)
  const themeReady = themes.some((t) => t.id === activeThemeId)
  const translationReady = activeTranslationId > 0
  const ndiSdkInstalled = Boolean(assetStatus?.ndi_sdk)
  const ndiStatus: ReadinessStatus = ndiSdkInstalled ? "ready" : "warning"

  const checks: ReadinessCheck[] = [
    {
      id: "audio",
      label: "Audio input",
      status: micHealthy ? "ready" : "warning",
      detail: micHealthy
        ? "Signal detected or transcription is active"
        : "Start transcribing or check input gain in Settings",
    },
    {
      id: "stt",
      label: "Speech-to-text",
      status: sttReady ? "ready" : "unavailable",
      detail:
        sttProvider === "deepgram"
          ? hasDeepgramApiKey
            ? "Deepgram key configured"
            : "Add a Deepgram API key in Settings"
          : assetStatus?.vosk_model && assetStatus?.vosk_worker
            ? "Local Vosk model ready"
            : "Install or configure the local Vosk model",
    },
    {
      id: "translation",
      label: "Bible translation",
      status: translationReady ? "ready" : "warning",
      detail: translationReady
        ? `Active translation id ${activeTranslationId}`
        : "Select a translation in Settings",
    },
    {
      id: "ndi",
      label: "NDI / display",
      status: ndiStatus,
      detail: ndiSdkInstalled
        ? "NDI SDK installed — configure output in Broadcast"
        : "Optional: install NDI SDK for OBS/vMix integration",
    },
    {
      id: "theme",
      label: "Theme",
      status: themeReady ? "ready" : "warning",
      detail: themeReady
        ? themes.find((t) => t.id === activeThemeId)?.name ?? "Theme selected"
        : "Choose a theme in Design",
    },
    {
      id: "test-verse",
      label: "Test verse to live",
      status: "warning",
      detail: "Send Genesis 1:1 to verify preview and live output",
      actionLabel: "Send test",
      onAction: () => void sendTestVerse(),
    },
  ]

  return { checks }
}
