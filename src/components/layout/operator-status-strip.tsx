import { useState, useEffect, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Badge } from "@/components/ui/badge"
import { LevelMeter } from "@/components/ui/level-meter"
import { cn } from "@/lib/utils"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { detectionActions } from "@/hooks/use-detection"
import { transcriptionActions } from "@/hooks/use-transcription"
import {
  MicIcon,
  RadioIcon,
  Rows3Icon,
  SwatchBookIcon,
  EyeOffIcon,
  StopCircleIcon,
  Trash2Icon,
  XIcon,
  PauseCircleIcon,
  BellOffIcon,
  BellRingIcon,
} from "lucide-react"

function confirmAction(message: string): boolean {
  return window.confirm(message)
}

function StripButton({
  onClick,
  disabled,
  title,
  children,
  variant = "default",
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: ReactNode
  variant?: "default" | "danger" | "success"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-[0.625rem] font-medium uppercase tracking-wider transition-colors",
        disabled && "cursor-not-allowed text-muted-foreground/30",
        !disabled &&
          variant === "danger" &&
          "text-red-500 hover:bg-red-500/15 hover:text-red-400",
        !disabled &&
          variant === "success" &&
          "text-primary hover:bg-primary/15 hover:text-primary",
        !disabled &&
          variant === "default" &&
          "text-brand-yellow hover:bg-brand-yellow/15 hover:text-brand-yellow",
      )}
    >
      {children}
    </button>
  )
}

export function OperatorStatusStrip() {
  const audioLevel = useAudioStore((s) => s.level)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveItem = useBroadcastStore((s) => s.liveItem)
  const previewItem = useBroadcastStore((s) => s.previewItem)
  const readingModeAutoLive = useBroadcastStore((s) => s.readingModeAutoLive)
  const queueLength = useQueueStore((s) => s.items.length)
  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)
  const activeTheme = themes.find((t) => t.id === activeThemeId)
  const selectedVerse = useBibleStore((s) => s.selectedVerse)

  const [detectionPaused, setDetectionPaused] = useState(false)

  useEffect(() => {
    detectionActions
      .getDetectionControlStatus()
      .then((status) => setDetectionPaused(status.detection_paused))
      .catch((e) =>
        console.error("[operator-strip] detection control status failed", e),
      )
  }, [])

  const clearLiveOutput = () => {
    if (
      !confirmAction(
        "Clear live output? This removes the on-air verse and turns off live mode.",
      )
    ) {
      return
    }
    useBroadcastStore.getState().setLiveItem(null)
    useBroadcastStore.getState().setLive(false)
  }

  const clearPreview = () => {
    useBroadcastStore.getState().setPreviewItem(null)
    useBibleStore.getState().selectVerse(null)
  }

  const pauseAutoLive = () => {
    useBroadcastStore.getState().setReadingModeAutoLive(false)
    invoke("stop_reading_mode").catch((e) =>
      console.error("[operator-strip] stop reading mode failed", e),
    )
  }

  const toggleDetectionPaused = () => {
    const next = !detectionPaused
    detectionActions
      .setDetectionPaused(next)
      .then(() => {
        setDetectionPaused(next)
      })
      .catch((e) =>
        console.error("[operator-strip] toggle detection paused failed", e),
      )
  }

  const stopTranscription = () => {
    if (
      !confirmAction(
        "Stop transcription? Speech-to-text will stop until you start it again.",
      )
    ) {
      return
    }
    void transcriptionActions.stop()
  }

  return (
    <div
      data-slot="operator-status-strip"
      className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-elevated/80 px-3 py-1 text-xs text-muted-foreground"
    >
      <div
        data-zone="safe"
        className="flex flex-wrap items-center gap-3"
        aria-label="Safe status"
      >
        <div className="flex items-center gap-2">
          <Rows3Icon className="size-3.5" />
          <span>{queueLength} queued</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <SwatchBookIcon className="size-3.5 shrink-0" />
          <span className="max-w-[160px] truncate">
            {activeTheme?.name ?? "No theme"}
          </span>
        </div>
      </div>

      <div
        data-zone="live"
        className="flex flex-wrap items-center gap-3"
        aria-label="Live status"
      >
        <div className="flex items-center gap-2">
          <MicIcon className="size-3.5" />
          <LevelMeter level={audioLevel.rms} bars={5} />
          <span>{isTranscribing ? "Listening" : "Idle"}</span>
        </div>

        <div className="flex items-center gap-2">
          <RadioIcon
            className={cn("size-3.5", isLive && "text-primary")}
          />
          <Badge
            variant={isLive ? "default" : "outline"}
            className={cn(
              "h-5 text-[0.5625rem] uppercase",
              isLive && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {isLive ? "On air" : "Hidden"}
          </Badge>
          <span className="max-w-[240px] truncate">
            {liveItem?.reference ?? "No live verse"}
          </span>
        </div>

        <StripButton
          onClick={() => useBroadcastStore.getState().setLive(false)}
          disabled={!isLive}
          title="Hide Live Output"
          variant="danger"
        >
          <EyeOffIcon className="size-3.5" />
          Hide output
        </StripButton>
      </div>

      <div
        data-zone="emergency"
        className="ml-auto flex flex-wrap items-center gap-1"
        aria-label="Emergency controls"
      >
        <StripButton
          onClick={clearLiveOutput}
          disabled={!liveItem && !isLive}
          title="Clear Live Output"
        >
          <Trash2Icon className="size-3.5" />
          Clear live
        </StripButton>
        <StripButton
          onClick={clearPreview}
          disabled={!previewItem && !selectedVerse}
          title="Clear Preview"
        >
          <XIcon className="size-3.5" />
          Clear preview
        </StripButton>
        <StripButton
          onClick={pauseAutoLive}
          disabled={!readingModeAutoLive}
          title="Pause Auto-Live"
        >
          <PauseCircleIcon className="size-3.5" />
          Pause auto-live
        </StripButton>
        <StripButton
          onClick={toggleDetectionPaused}
          title={detectionPaused ? "Resume Suggestions" : "Pause Suggestions"}
          variant={detectionPaused ? "success" : "default"}
        >
          {detectionPaused ? (
            <BellRingIcon className="size-3.5" />
          ) : (
            <BellOffIcon className="size-3.5" />
          )}
          {detectionPaused ? "Resume" : "Pause"} suggestions
        </StripButton>
        <StripButton
          onClick={stopTranscription}
          disabled={!isTranscribing}
          title="Stop Transcription"
          variant="danger"
        >
          <StopCircleIcon className="size-3.5" />
          Stop STT
        </StripButton>
      </div>
    </div>
  )
}
