import { useEffect } from "react"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { useBroadcastOutputIssueStore as useBroadcastStore } from "@/stores/broadcast/output-issue-store"
import { useSettingsStore } from "@/stores/settings-store"

export function useDetectionSettingsSync() {
  useEffect(() => {
    if (!isTauriRuntime()) return

    let prev = {
      autoMode: useSettingsStore.getState().autoMode,
      semanticDetectionEnabled:
        useSettingsStore.getState().semanticDetectionEnabled,
      confidenceThreshold: useSettingsStore.getState().confidenceThreshold,
      semanticConfidenceThreshold:
        useSettingsStore.getState().semanticConfidenceThreshold,
      cooldownMs: useSettingsStore.getState().cooldownMs,
    }

    const sync = (next = useSettingsStore.getState()) => {
      void invokeTauri("update_detection_settings", {
        autoMode: next.autoMode,
        semanticDetectionEnabled: next.semanticDetectionEnabled,
        confidenceThreshold: next.confidenceThreshold,
        semanticConfidenceThreshold: next.semanticConfidenceThreshold,
        cooldownMs: next.cooldownMs,
      }).catch((e) => {
        console.warn("[detection-settings] sync failed", e)
        useBroadcastStore.getState().reportOutputIssue({
          outputId: "global",
          kind: "detection-settings",
          title: "Detection settings sync failed",
          description: `Could not sync detection settings to backend: ${String(e)}`,
        })
      })
    }

    sync()

    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (
        state.autoMode === prev.autoMode &&
        state.semanticDetectionEnabled === prev.semanticDetectionEnabled &&
        state.confidenceThreshold === prev.confidenceThreshold &&
        state.semanticConfidenceThreshold ===
          prev.semanticConfidenceThreshold &&
        state.cooldownMs === prev.cooldownMs
      ) {
        return
      }

      prev = {
        autoMode: state.autoMode,
        semanticDetectionEnabled: state.semanticDetectionEnabled,
        confidenceThreshold: state.confidenceThreshold,
        semanticConfidenceThreshold: state.semanticConfidenceThreshold,
        cooldownMs: state.cooldownMs,
      }

      sync(state)
    })

    return unsubscribe
  }, [])
}
