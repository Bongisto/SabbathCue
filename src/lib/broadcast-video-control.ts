import { emitTo } from "@tauri-apps/api/event"
import {
  VIDEO_TIMEUPDATE_EVENT,
  VIDEO_TRANSPORT_EVENT,
} from "@/lib/library/library-video"
import type { PresentationRenderData, VideoPresentationSource } from "@/types"

export type VideoTransportCommand =
  | { type: "load"; item: PresentationRenderData }
  | { type: "play" }
  | { type: "pause" }
  | { type: "restart" }
  | { type: "seek"; currentTime: number }
  | { type: "setVolume"; volume: number }
  | { type: "setMuted"; muted: boolean }
  | { type: "setLoop"; loop: boolean }
  | { type: "setSinkId"; sinkId: string }
  | { type: "stop" }

export interface VideoTimeUpdatePayload {
  outputId: string
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  volume: number
  loop: boolean
  ended: boolean
}

export const BROADCAST_OUTPUT_LABELS = [
  "broadcast",
  "broadcast-alt",
  "main",
] as const

export function clampVideoVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1
  return Math.max(0, Math.min(1, volume))
}

export function buildVideoCommand(
  command: VideoTransportCommand
): VideoTransportCommand {
  if (command.type === "seek") {
    return {
      ...command,
      currentTime: Math.max(0, command.currentTime),
    }
  }
  if (command.type === "setVolume") {
    return {
      ...command,
      volume: clampVideoVolume(command.volume),
    }
  }
  return command
}

export function videoSourceUrl(video: VideoPresentationSource): string | null {
  if (video.source === "local") return video.videoPath ?? null
  if (video.source === "url") return video.url ?? null
  if (video.source === "youtube") return video.youtubeId ?? null
  return null
}

export async function emitVideoCommand(
  command: VideoTransportCommand,
  labels = BROADCAST_OUTPUT_LABELS
): Promise<void> {
  const payload = buildVideoCommand(command)
  await Promise.all(
    labels.map((label) => emitTo(label, VIDEO_TRANSPORT_EVENT, payload))
  )
}

export async function emitVideoTimeUpdate(
  payload: VideoTimeUpdatePayload
): Promise<void> {
  await emitTo("main", VIDEO_TIMEUPDATE_EVENT, payload)
}
