import { open } from "@tauri-apps/plugin-dialog"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { LibraryVideoAsset } from "@/types/library"

export const LIBRARY_VIDEO_EXTENSIONS = ["mp4", "webm"] as const
export const VIDEO_TRANSPORT_EVENT = "broadcast:video-control"
export const VIDEO_TIMEUPDATE_EVENT = "broadcast:video-timeupdate"

export interface ValidatedLibraryVideo {
  label: string
  sizeBytes: number
  mimeType: string
}

export interface VideoMetadata {
  durationMs?: number
  width?: number
  height?: number
  thumbnail?: string
}

export async function pickLibraryVideoPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Videos", extensions: [...LIBRARY_VIDEO_EXTENSIONS] }],
  })
  return typeof selected === "string" ? selected : null
}

export async function validateLibraryVideoPath(
  path: string,
): Promise<ValidatedLibraryVideo> {
  return invokeTauri<ValidatedLibraryVideo>("validate_video_path", { path })
}

export function isProgressiveVideoUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return (
      url.protocol === "https:" &&
      LIBRARY_VIDEO_EXTENSIONS.some((extension) =>
        url.pathname.toLowerCase().endsWith(`.${extension}`),
      )
    )
  } catch {
    return false
  }
}

export function parseYoutubeId(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.hostname === "youtu.be") {
      return normalizeYoutubeId(
        url.pathname.split("/").filter(Boolean)[0] ?? "",
      )
    }
    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        return normalizeYoutubeId(url.searchParams.get("v") ?? "")
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return normalizeYoutubeId(url.pathname.split("/")[2] ?? "")
      }
    }
  } catch {
    return normalizeYoutubeId(value)
  }
  return null
}

function normalizeYoutubeId(value: string): string | null {
  const id = value.trim()
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

export function videoAssetToPresentation(asset: LibraryVideoAsset) {
  return {
    kind: "video" as const,
    videoId: asset.id,
    title: asset.name,
    source: asset.source,
    videoPath: asset.filePath,
    url: asset.url,
    youtubeId: asset.youtubeId,
    poster: asset.thumbnail,
    durationMs: asset.durationMs,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    reference: asset.name,
    segments: [{ text: asset.name }],
  }
}

const VIDEO_METADATA_TIMEOUT_MS = 10_000

export async function readVideoMetadata(src: string): Promise<VideoMetadata> {
  if (typeof document === "undefined") return {}

  const video = document.createElement("video")
  video.preload = "metadata"
  video.muted = true
  video.crossOrigin = "anonymous"

  return new Promise((resolve) => {
    let settled = false
    let partialMetadata: VideoMetadata = {}
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      video.onloadedmetadata = null
      video.onseeked = null
      video.onerror = null
      video.removeAttribute("src")
      video.load()
    }

    const finish = (metadata: VideoMetadata) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(metadata)
    }

    timeoutId = setTimeout(
      () => finish(partialMetadata),
      VIDEO_METADATA_TIMEOUT_MS,
    )

    video.onloadedmetadata = () => {
      const duration = video.duration
      const durationMs =
        Number.isFinite(duration) && duration >= 0
          ? Math.round(duration * 1000)
          : undefined
      const width = video.videoWidth || undefined
      const height = video.videoHeight || undefined
      partialMetadata = { durationMs, width, height }

      if (!Number.isFinite(duration) || duration <= 0) {
        finish(partialMetadata)
        return
      }

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = width ?? 320
          canvas.height = height ?? 180
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            finish(partialMetadata)
            return
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          finish({
            durationMs,
            width,
            height,
            thumbnail: canvas.toDataURL("image/jpeg", 0.72),
          })
        } catch {
          finish(partialMetadata)
        }
      }
      video.currentTime = Math.min(0.1, duration)
    }
    video.onerror = () => finish({})
    video.src = src
  })
}
