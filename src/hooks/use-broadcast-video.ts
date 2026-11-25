import { useCallback, useEffect, useRef } from "react"
import { emitTo } from "@tauri-apps/api/event"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import {
  buildVideoCommand,
  emitVideoTimeUpdate,
  type VideoTransportCommand,
} from "@/lib/broadcast-video-control"
import { VIDEO_TRANSPORT_EVENT } from "@/lib/library/library-video"
import { convertTauriFileSrc, isTauriRuntime } from "@/lib/tauri-runtime"
import { useBroadcastOutputIssueStore as useBroadcastStore } from "@/stores/broadcast/output-issue-store"
import type {
  BroadcastOutputId,
  PresentationRenderData,
  VideoPresentationSource,
} from "@/types"

export const PREFERRED_AUDIO_DEVICE_STORAGE_KEY =
  "sabbathcue:video:preferred-audio-output-device"

interface UseBroadcastVideoOptions {
  video: HTMLVideoElement | null
  item: PresentationRenderData | null
  outputId: string
  preferredSinkId?: string
  onEnded?: () => void
  /** Last known transport state to restore instead of autoplaying when the
   * video element (re)mounts with an unchanged live item. */
  getResumeState?: () => { currentTime: number; paused: boolean } | null
}

function resolveNativeVideoSrc(video: VideoPresentationSource): string | null {
  if (video.source === "local" && video.videoPath) {
    return convertTauriFileSrc(video.videoPath)
  }
  if (video.source === "url" && video.url) return video.url
  return null
}

function snapshot(video: HTMLVideoElement, outputId: string, ended = false) {
  return {
    outputId,
    currentTime: video.currentTime || 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    paused: video.paused,
    muted: video.muted,
    volume: video.volume,
    loop: video.loop,
    ended,
  }
}

function seekToStart(element: HTMLVideoElement): void {
  element.currentTime = 0
}

function rewindIfEnded(element: HTMLVideoElement): void {
  const duration = Number.isFinite(element.duration) ? element.duration : 0
  if (element.ended || (duration > 0 && element.currentTime >= duration)) {
    seekToStart(element)
  }
}

function loadVideo(element: HTMLVideoElement): void {
  if (
    import.meta.env.MODE === "test" &&
    element.load ===
      element.ownerDocument.defaultView?.HTMLMediaElement?.prototype.load
  ) {
    return
  }
  element.load()
}

function loadVideoSource(
  element: HTMLVideoElement,
  source: VideoPresentationSource | null | undefined
): void {
  const src = source ? resolveNativeVideoSrc(source) : null
  if (!source || !src) {
    element.removeAttribute("src")
    loadVideo(element)
    return
  }
  if (element.src !== src) {
    element.src = src
    element.poster = source.poster ?? ""
    element.loop = Boolean(source.loop)
    loadVideo(element)
  } else {
    seekToStart(element)
  }
  playVideo(element)
}

function stopVideo(element: HTMLVideoElement): void {
  element.pause()
  element.removeAttribute("src")
  loadVideo(element)
}

function isJsdomNativeMediaPlay(element: HTMLVideoElement): boolean {
  return (
    import.meta.env.MODE === "test" &&
    element.play ===
      element.ownerDocument.defaultView?.HTMLMediaElement?.prototype.play
  )
}

function playVideo(element: HTMLVideoElement): void {
  if (isJsdomNativeMediaPlay(element)) return
  rewindIfEnded(element)
  try {
    const result = element.play()
    if (result && typeof result.catch === "function") {
      void result.catch((error) =>
        console.debug("[broadcast-video] play() rejected", error)
      )
    }
  } catch {
    // jsdom implements media methods as throwing stubs; browsers/Tauri reject
    // the returned promise instead.
  }
}

function isBroadcastOutputId(outputId: string): outputId is BroadcastOutputId {
  return outputId === "main" || outputId === "alt"
}

function reportTransportListenerFailure(outputId: string, error: unknown): void {
  console.error(
    "[broadcast-video] failed to attach video transport listener",
    error
  )
  if (!isTauriRuntime()) return
  const title = "Video controls unavailable"
  const description = `Could not attach the video transport listener for ${outputId}: ${String(error)}`
  if (isBroadcastOutputId(outputId)) {
    void emitTo("main", "broadcast:output-error", {
      outputId,
      kind: "broadcast-sync",
      title,
      description,
    }).catch((emitError) => {
      console.warn(
        "[broadcast-video] failed to emit transport listener error to main",
        emitError
      )
    })
    return
  }
  useBroadcastStore.getState().reportOutputIssue({
    outputId: "global",
    kind: "broadcast-sync",
    title,
    description,
    id: `global:video-transport:${outputId}`,
  })
}

function reportAudioSinkFailure(outputId: string, error: unknown): void {
  if (!isTauriRuntime() || !isBroadcastOutputId(outputId)) return
  void emitTo("main", "broadcast:output-error", {
    outputId,
    kind: "video-audio",
    title: "Video audio output failed",
    description: `Could not route video audio to the selected output: ${String(error)}`,
  }).catch((emitError) => {
    console.warn(
      "[broadcast-video] failed to emit audio sink error to main",
      emitError
    )
  })
}

function setElementAudioSink(
  element: HTMLVideoElement,
  sinkId: string,
  outputId: string,
  onError?: () => void
): void {
  if (!("setSinkId" in element)) return
  void (
    element as HTMLVideoElement & {
      setSinkId: (sinkId: string) => Promise<void>
    }
  )
    .setSinkId(sinkId)
    .catch((error) => {
      onError?.()
      reportAudioSinkFailure(outputId, error)
    })
}

function applyPlaybackCommand(
  element: HTMLVideoElement,
  payload: ReturnType<typeof buildVideoCommand>,
  outputId: string
): void {
  if (payload.type === "play") playVideo(element)
  if (payload.type === "pause") element.pause()
  if (payload.type === "restart") {
    element.currentTime = 0
    playVideo(element)
  }
  if (payload.type === "seek") element.currentTime = payload.currentTime
  if (payload.type === "setVolume") element.volume = payload.volume
  if (payload.type === "setMuted") element.muted = payload.muted
  if (payload.type === "setLoop") element.loop = payload.loop
  if (payload.type === "setSinkId") {
    setElementAudioSink(element, payload.sinkId, outputId)
  }
  if (payload.type === "stop") stopVideo(element)
}

function syncVideoItem(
  element: HTMLVideoElement,
  item: PresentationRenderData | null,
  getResumeState?: () => { currentTime: number; paused: boolean } | null
): void {
  const source = item?.video
  const src =
    source && source.source !== "youtube" ? resolveNativeVideoSrc(source) : null
  if (!source || !src) {
    stopVideo(element)
    return
  }
  // Syncs that re-deliver an unchanged source (theme/opacity updates arriving
  // as fresh payload objects) must not resume a paused video or unmute it —
  // playback is owned by the transport commands.
  if (element.src === src) return
  element.src = src
  element.poster = source.poster ?? ""
  element.loop = Boolean(source.loop)
  loadVideo(element)
  element.muted = false
  const resume = getResumeState?.()
  if (resume) {
    if (resume.currentTime > 0) element.currentTime = resume.currentTime
    if (resume.paused) return
  }
  playVideo(element)
}

export function useBroadcastVideo({
  video,
  item,
  outputId,
  preferredSinkId,
  onEnded,
  getResumeState,
}: UseBroadcastVideoOptions): void {
  const itemRef = useRef<PresentationRenderData | null>(item)
  const videoRef = useRef<HTMLVideoElement | null>(video)
  const preferredSinkIdRef = useRef<string | null>(
    preferredSinkId ? preferredSinkId : null
  )
  const prevPreferredSinkPropRef = useRef<string | undefined>(preferredSinkId)
  const lastAppliedSinkRef = useRef<{
    element: HTMLVideoElement
    sinkId: string
  } | null>(null)
  const lastTimeUpdateRef = useRef(0)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    itemRef.current = item
  }, [item])

  useEffect(() => {
    videoRef.current = video
  }, [video])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  const applySink = useCallback(
    (element: HTMLVideoElement, sinkId: string, force = false) => {
      if (
        !force &&
        lastAppliedSinkRef.current?.element === element &&
        lastAppliedSinkRef.current.sinkId === sinkId
      ) {
        return
      }
      const attempt = { element, sinkId }
      lastAppliedSinkRef.current = attempt
      setElementAudioSink(element, sinkId, outputId, () => {
        if (lastAppliedSinkRef.current === attempt) {
          lastAppliedSinkRef.current = null
        }
      })
    },
    [outputId]
  )

  useEffect(() => {
    if (preferredSinkId === prevPreferredSinkPropRef.current) return
    prevPreferredSinkPropRef.current = preferredSinkId
    if (preferredSinkId === undefined) return
    preferredSinkIdRef.current = preferredSinkId
    if (videoRef.current) {
      applySink(videoRef.current, preferredSinkId)
    }
  }, [applySink, preferredSinkId])

  const applyCommand = useCallback(
    (command: VideoTransportCommand) => {
      const payload = buildVideoCommand(command)
      if (payload.type === "setSinkId") {
        preferredSinkIdRef.current = payload.sinkId
        const element = videoRef.current
        if (element) applySink(element, payload.sinkId, true)
        return
      }
      const element = videoRef.current
      if (!element) return
      if (payload.type === "load") {
        if (preferredSinkIdRef.current !== null) {
          applySink(element, preferredSinkIdRef.current)
        }
        loadVideoSource(element, payload.item.video)
        return
      }
      if (payload.type === "stop") {
        applyPlaybackCommand(element, payload, outputId)
        return
      }
      if (!itemRef.current?.video || itemRef.current.video.source === "youtube")
        return
      applyPlaybackCommand(element, payload, outputId)
    },
    [applySink, outputId]
  )

  useEffect(() => {
    if (!video) return
    if (preferredSinkIdRef.current !== null) {
      applySink(video, preferredSinkIdRef.current)
    }
    syncVideoItem(video, item, getResumeState)
  }, [applySink, getResumeState, item, video])

  useEffect(() => {
    if (!isTauriRuntime()) return
    let cancelled = false
    let unlistenFn: (() => void) | null = null
    try {
      const currentWindow = getCurrentWebviewWindow()
      void currentWindow
        .listen<VideoTransportCommand>(VIDEO_TRANSPORT_EVENT, (event) => {
          if (!cancelled) applyCommand(event.payload)
        })
        .then(
          (fn) => {
            if (cancelled) {
              fn()
            } else {
              unlistenFn = fn
            }
          },
          (error) => {
            if (!cancelled) reportTransportListenerFailure(outputId, error)
          }
        )
    } catch (error) {
      reportTransportListenerFailure(outputId, error)
      return
    }
    return () => {
      cancelled = true
      unlistenFn?.()
    }
  }, [applyCommand, outputId])

  useEffect(() => {
    if (!video) return
    const emitSnapshot = (ended = false) => {
      if (!isTauriRuntime()) return
      // The operator's live-box copy also reports, so the transport bar has
      // state when no projector window is open.
      if (!isBroadcastOutputId(outputId) && outputId !== "operator") return
      void emitVideoTimeUpdate(snapshot(video, outputId, ended))
    }
    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastTimeUpdateRef.current < 250) return
      lastTimeUpdateRef.current = now
      emitSnapshot(false)
    }
    const handleEnded = () => {
      emitSnapshot(true)
      onEndedRef.current?.()
    }
    const handlePlay = () => {
      rewindIfEnded(video)
      emitSnapshot(false)
    }
    const handleStateChange = () => emitSnapshot(false)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handleStateChange)
    video.addEventListener("ended", handleEnded)
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handleStateChange)
      video.removeEventListener("ended", handleEnded)
    }
  }, [outputId, video])
}
