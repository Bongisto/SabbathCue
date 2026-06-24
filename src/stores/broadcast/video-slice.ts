import { type StateCreator } from "zustand"
import {
  buildVideoCommand,
  emitVideoCommand,
  type VideoTimeUpdatePayload,
  type VideoTransportCommand,
} from "@/lib/broadcast-video-control"
import { restorePresentationDeckForQueueItem } from "@/lib/queued-presentation-deck"
import { getPresentationRenderData } from "@/types"
import { useQueueStore } from "@/stores/queue-store"
import type { BroadcastState } from "@/stores/broadcast-store"

export type VideoEndDecision = "loop" | "advance" | "hold"

const PREFERRED_AUDIO_DEVICE_STORAGE_KEY =
  "sabbathcue:video:preferred-audio-output-device"

export function decideVideoEndAction(input: {
  loop: boolean
  autoAdvance: boolean
  hasNextItem: boolean
}): VideoEndDecision {
  if (input.loop) return "loop"
  if (input.autoAdvance && input.hasNextItem) return "advance"
  return "hold"
}

function readPreferredAudioOutputDeviceId(): string {
  try {
    return (
      globalThis.localStorage.getItem(PREFERRED_AUDIO_DEVICE_STORAGE_KEY) ?? ""
    )
  } catch {
    return ""
  }
}

function savePreferredAudioOutputDeviceId(deviceId: string): void {
  try {
    globalThis.localStorage.setItem(
      PREFERRED_AUDIO_DEVICE_STORAGE_KEY,
      deviceId
    )
  } catch {
    // localStorage is optional in test and non-browser runtimes.
  }
}

export interface VideoSlice {
  videoTransport: VideoTimeUpdatePayload | null
  videoLoop: boolean
  videoMuted: boolean
  videoVolume: number
  autoAdvanceVideoOnEnd: boolean
  preferredAudioOutputDeviceId: string
  sendVideoCommand: (command: VideoTransportCommand) => void
  setVideoTransport: (payload: VideoTimeUpdatePayload) => void
  setVideoLoop: (loop: boolean) => void
  setVideoMuted: (muted: boolean) => void
  setVideoVolume: (volume: number) => void
  setPreferredAudioOutputDeviceId: (deviceId: string) => void
  setAutoAdvanceVideoOnEnd: (enabled: boolean) => void
  handleVideoEnded: () => VideoEndDecision
}

export const createVideoSlice: StateCreator<
  BroadcastState,
  [],
  [],
  VideoSlice
> = (set, get) => ({
  videoTransport: null,
  videoLoop: false,
  videoMuted: false,
  videoVolume: 1,
  autoAdvanceVideoOnEnd: true,
  preferredAudioOutputDeviceId: readPreferredAudioOutputDeviceId(),

  sendVideoCommand: (command) => {
    const payload = buildVideoCommand(command)
    if (payload.type === "setLoop") set({ videoLoop: payload.loop })
    if (payload.type === "setMuted") set({ videoMuted: payload.muted })
    if (payload.type === "setVolume") set({ videoVolume: payload.volume })
    if (payload.type === "setSinkId") {
      savePreferredAudioOutputDeviceId(payload.sinkId)
      set({ preferredAudioOutputDeviceId: payload.sinkId })
    }
    void emitVideoCommand(payload).catch((error) => {
      console.warn("[broadcast-store] video command emit failed", error)
      get().reportOutputIssue({
        outputId: "global",
        kind: "broadcast-sync",
        title: "Video control failed",
        description: `Could not send video control: ${String(error)}`,
      })
    })
  },
  setVideoTransport: (payload) => {
    set({
      videoTransport: payload,
      videoLoop: payload.loop,
      videoMuted: payload.muted,
      videoVolume: payload.volume,
    })
  },
  setVideoLoop: (loop) => {
    set({ videoLoop: loop })
    get().sendVideoCommand({ type: "setLoop", loop })
  },
  setVideoMuted: (muted) => {
    set({ videoMuted: muted })
    get().sendVideoCommand({ type: "setMuted", muted })
  },
  setVideoVolume: (volume) => {
    const nextVolume = Math.max(
      0,
      Math.min(1, Number.isFinite(volume) ? volume : 1)
    )
    set({ videoVolume: nextVolume })
    get().sendVideoCommand({ type: "setVolume", volume: nextVolume })
  },
  setPreferredAudioOutputDeviceId: (deviceId) => {
    savePreferredAudioOutputDeviceId(deviceId)
    set({ preferredAudioOutputDeviceId: deviceId })
    get().sendVideoCommand({ type: "setSinkId", sinkId: deviceId })
  },
  setAutoAdvanceVideoOnEnd: (enabled) => {
    set({ autoAdvanceVideoOnEnd: enabled })
  },
  handleVideoEnded: () => {
    const queue = useQueueStore.getState()
    const nextIndex =
      queue.activeIndex === null
        ? -1
        : Math.min(queue.activeIndex + 1, queue.items.length - 1)
    const nextItem = nextIndex >= 0 ? queue.items[nextIndex] : null
    const decision = decideVideoEndAction({
      loop: get().videoLoop,
      autoAdvance: get().autoAdvanceVideoOnEnd,
      hasNextItem: Boolean(nextItem),
    })

    if (decision === "loop") {
      get().sendVideoCommand({ type: "restart" })
      return decision
    }
    if (decision === "advance" && nextItem) {
      queue.setActive(nextIndex)
      restorePresentationDeckForQueueItem(nextItem)
      const renderData = getPresentationRenderData(nextItem.presentation)
      get().commitLiveItem(renderData)
    }
    return decision
  },
})
