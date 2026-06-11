import { getVersion } from "@tauri-apps/api/app"
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { isTauriRuntime } from "@/lib/tauri-runtime"

export type UpdateCheckResult =
  | { ok: true; update: null }
  | { ok: true; update: Update }
  | { ok: false; message: string }

export type DownloadProgress = {
  downloaded: number
  contentLength: number | null
}

export async function getAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return "0.0.0"
  return getVersion()
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { ok: false, message: "Updates are only available in the desktop app." }
  }

  try {
    const update = await check()
    if (!update) return { ok: true, update: null }
    return { ok: true, update }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update check failed."
    return { ok: false, message }
  }
}

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  await update.downloadAndInstall((event: DownloadEvent) => {
    if (!onProgress) return
    switch (event.event) {
      case "Started":
        onProgress({ downloaded: 0, contentLength: event.data.contentLength ?? null })
        break
      case "Progress":
        onProgress({
          downloaded: event.data.chunkLength,
          contentLength: null,
        })
        break
      case "Finished":
        break
    }
  })
}

export async function relaunchApp(): Promise<void> {
  if (!isTauriRuntime()) return
  await relaunch()
}
