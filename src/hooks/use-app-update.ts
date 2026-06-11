import { useCallback, useRef, useState } from "react"
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  getAppVersion,
  relaunchApp,
} from "@/lib/updater"
import { isTauriRuntime } from "@/lib/tauri-runtime"

export type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installed"
  | "error"

export interface AppUpdateState {
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  downloadPercent: number | null
  error: string | null
}

const initialState: AppUpdateState = {
  phase: "idle",
  currentVersion: "",
  availableVersion: null,
  downloadPercent: null,
  error: null,
}

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>(initialState)
  const downloadedRef = useRef(0)
  const contentLengthRef = useRef<number | null>(null)
  const autoCheckDoneRef = useRef(false)

  const loadVersion = useCallback(async () => {
    const version = await getAppVersion()
    setState((prev) => ({ ...prev, currentVersion: version }))
    return version
  }, [])

  const check = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isTauriRuntime()) {
        const message = "Updates are only available in the desktop app."
        if (!options?.silent) {
          setState((prev) => ({ ...prev, phase: "error", error: message }))
        }
        return { available: false as const, error: message }
      }

      setState((prev) => ({
        ...prev,
        phase: "checking",
        error: null,
        downloadPercent: null,
      }))

      await loadVersion()
      const result = await checkForUpdate()

      if (!result.ok) {
        if (!options?.silent) {
          setState((prev) => ({
            ...prev,
            phase: "error",
            error: result.message,
          }))
        } else {
          console.warn("[updater] auto-check failed:", result.message)
          setState((prev) => ({ ...prev, phase: "idle", error: null }))
        }
        return { available: false as const, error: result.message }
      }

      if (!result.update) {
        setState((prev) => ({
          ...prev,
          phase: "idle",
          availableVersion: null,
          error: null,
        }))
        return { available: false as const, error: null }
      }

      setState((prev) => ({
        ...prev,
        phase: "available",
        availableVersion: result.update.version,
        error: null,
      }))
      return { available: true as const, update: result.update, error: null }
    },
    [loadVersion],
  )

  const install = useCallback(async () => {
    const checkResult = await checkForUpdate()
    if (!checkResult.ok || !checkResult.update) {
      const message = checkResult.ok
        ? "No update is available."
        : checkResult.message
      setState((prev) => ({ ...prev, phase: "error", error: message }))
      return { ok: false as const, message }
    }

    downloadedRef.current = 0
    contentLengthRef.current = null
    setState((prev) => ({
      ...prev,
      phase: "downloading",
      downloadPercent: 0,
      error: null,
    }))

    try {
      await downloadAndInstallUpdate(checkResult.update, (progress) => {
        if (progress.contentLength !== null) {
          contentLengthRef.current = progress.contentLength
          downloadedRef.current = 0
        } else {
          downloadedRef.current += progress.downloaded
        }

        const total = contentLengthRef.current
        const percent =
          total && total > 0
            ? Math.min(100, Math.round((downloadedRef.current / total) * 100))
            : null

        setState((prev) => ({
          ...prev,
          phase: "downloading",
          downloadPercent: percent,
        }))
      })

      setState((prev) => ({
        ...prev,
        phase: "installed",
        downloadPercent: 100,
      }))
      await relaunchApp()
      return { ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update installation failed."
      setState((prev) => ({ ...prev, phase: "error", error: message }))
      return { ok: false as const, message }
    }
  }, [])

  const autoCheckOnce = useCallback(async () => {
    if (autoCheckDoneRef.current || !isTauriRuntime()) return null
    autoCheckDoneRef.current = true
    return check({ silent: true })
  }, [check])

  return {
    state,
    loadVersion,
    check,
    install,
    autoCheckOnce,
  }
}
