import { invokeTauri } from "@/lib/tauri-runtime"
import { openApiKeyPrompt } from "@/lib/api-key-prompt"
import { transcriptionActions } from "@/hooks/use-transcription"
import { useBibleStore } from "@/stores/bible-store"
import { getBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useTranscriptStore } from "@/stores/transcript-store"

export function clearLiveOutput(): void {
  const broadcast = getBroadcastLiveStore()
  broadcast.setLive(false)
  broadcast.setLiveItem(null)
}

export function clearPreviewOutput(): void {
  getBroadcastLiveStore().setPreviewItem(null)
  useBibleStore.getState().selectVerse(null)
}

export function toggleLiveOutputVisibility(): void {
  const broadcast = getBroadcastLiveStore()
  broadcast.setLive(!broadcast.isLive)
}

export function pauseReadingModeAutoLive(): void {
  getBroadcastLiveStore().setReadingModeAutoLive(false)
  invokeTauri("stop_reading_mode").catch((error) =>
    console.error("[operator-actions] stop reading mode failed", error)
  )
}

export function toggleTranscription(): void {
  const { isTranscribing, connectionStatus } = useTranscriptStore.getState()
  if (isTranscribing) {
    void transcriptionActions.stop()
    return
  }
  if (connectionStatus === "connecting") {
    return
  }

  void transcriptionActions.start(openApiKeyPrompt)
}
