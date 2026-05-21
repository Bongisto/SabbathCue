import { useEffect } from "react"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { useSettingsStore } from "@/stores/settings-store"

export function useDetectionSettingsSync() {
  useEffect(() => {
    if (!isTauriRuntime()) return

    let prev = {
      autoMode: useSettingsStore.getState().autoMode,
      confidenceThreshold: useSettingsStore.getState().confidenceThreshold,
      cooldownMs: useSettingsStore.getState().cooldownMs,
    }

    const sync = (next = useSettingsStore.getState()) => {
      void invokeTauri("update_detection_settings", {
        autoMode: next.autoMode,
        confidenceThreshold: next.confidenceThreshold,
        cooldownMs: next.cooldownMs,
      }).catch((e) => {
        console.warn("[detection-settings] sync failed", e)
      })
    }

    sync()

    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (
        state.autoMode === prev.autoMode &&
        state.confidenceThreshold === prev.confidenceThreshold &&
        state.cooldownMs === prev.cooldownMs
      ) {
        return
      }

      prev = {
        autoMode: state.autoMode,
        confidenceThreshold: state.confidenceThreshold,
        cooldownMs: state.cooldownMs,
      }

      sync(state)
    })

    return unsubscribe
  }, [])
}
