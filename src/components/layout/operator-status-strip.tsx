import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Badge } from "@/components/ui/badge"
import { LevelMeter } from "@/components/ui/level-meter"
import { cn } from "@/lib/utils"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
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
  const activePlan = useServicePlanStore((s) => s.activePlan)

  const [detectionPaused, setDetectionPaused] = useState(false)

  useEffect(() => {
    detectionActions.getDetectionControlStatus().then(
      (status) => setDetectionPaused(status.detection_paused)
    ).catch((e) => console.error("[operator-strip] detection control status failed", e))
  }, [])

  const clearLiveOutput = () => {
    useBroadcastStore.getState().setLiveItem(null)
    useBroadcastStore.getState().setLive(false)
  }

  const clearPreview = () => {
    useBroadcastStore.getState().setPreviewItem?.(null)
    useBibleStore.getState().selectVerse(null)
  }

  const pauseAutoLive = () => {
    useBroadcastStore.getState().setReadingModeAutoLive(false)
    invoke("stop_reading_mode").catch((e) => console.error("[operator-strip] stop reading mode failed", e))
  }

  const toggleDetectionPaused = () => {
    const next = !detectionPaused
    detectionActions.setDetectionPaused(next).then(() => {
      setDetectionPaused(next)
    }).catch((e) => console.error("[operator-strip] toggle detection paused failed", e))
  }

  const stripActionClass = (enabled: boolean, tone: "amber" | "emerald" | "red") =>
    cn(
      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors",
      enabled
        ? tone === "emerald"
          ? "text-emerald-500 hover:bg-emerald-500/15 hover:text-emerald-400"
          : tone === "red"
            ? "text-red-500 hover:bg-red-500/15 hover:text-red-400"
            : "text-amber-500 hover:bg-amber-500/15 hover:text-amber-400"
        : "cursor-not-allowed text-muted-foreground/30"
    )

  return (
    <section
      data-slot="operator-status-strip"
      className="controller-status-strip flex h-11 shrink-0 items-center justify-between gap-4 overflow-x-auto border-b border-white/[0.06] px-5 text-xs select-none"
    >
      <div className="flex min-w-max items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MicIcon className="size-3.5" />
          <LevelMeter level={audioLevel.rms} bars={5} />
          <span className="font-mono text-[11px]">
            {isTranscribing ? "Listening" : "Idle"}
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            Active program:
          </span>
          <span className="text-[11px] font-bold text-foreground">
            {activePlan?.name ?? "No service plan"}
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            Current live:
          </span>
          <span className="font-mono text-[11px] font-bold text-[var(--brand-accent)]">
            {liveItem?.reference ?? "—"}
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <RadioIcon
            className={cn("size-3.5", isLive && "text-emerald-500")}
          />
          <Badge
            variant={isLive ? "default" : "outline"}
            className={cn(
              "h-5 text-[0.5625rem] uppercase",
              isLive && "bg-emerald-500 text-white hover:bg-emerald-500",
            )}
          >
            {isLive ? "On air" : "Hidden"}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Rows3Icon className="size-3.5" />
          <span>{queueLength} queued</span>
        </div>
      </div>

      <div className="flex min-w-max shrink-0 items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-slate-900/60 px-2.5 py-0.5 text-[10px]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500",
            )}
          />
          <span className="font-mono text-muted-foreground">Broadcast:</span>
          <span className="font-semibold uppercase text-foreground">
            {isLive ? "On air" : "Standby"}
          </span>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          <SwatchBookIcon className="size-3.5 text-muted-foreground" />
          <span className="max-w-[120px] truncate text-muted-foreground">
            {activeTheme?.name ?? "No theme"}
          </span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearLiveOutput}
            disabled={!liveItem}
            title="Clear Live Output"
            className={stripActionClass(Boolean(liveItem), "amber")}
          >
            <Trash2Icon className="size-3" />
            Clear Live
          </button>
          <button
            type="button"
            onClick={clearPreview}
            disabled={!previewItem && !selectedVerse}
            title="Clear Preview"
            className={stripActionClass(
              Boolean(previewItem || selectedVerse),
              "amber"
            )}
          >
            <XIcon className="size-3" />
            Preview
          </button>
          <button
            type="button"
            onClick={pauseAutoLive}
            disabled={!readingModeAutoLive}
            title="Pause Auto-Live"
            className={stripActionClass(readingModeAutoLive, "amber")}
          >
            <PauseCircleIcon className="size-3" />
            Auto-live
          </button>
          <button
            type="button"
            onClick={toggleDetectionPaused}
            title={detectionPaused ? "Resume Suggestions" : "Pause Suggestions"}
            className={stripActionClass(true, detectionPaused ? "emerald" : "amber")}
          >
            {detectionPaused ? (
              <BellRingIcon className="size-3" />
            ) : (
              <BellOffIcon className="size-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => useBroadcastStore.getState().setLive(false)}
            disabled={!isLive}
            title="Hide Live Output"
            className={stripActionClass(isLive, "red")}
          >
            <EyeOffIcon className="size-3" />
            Hide
          </button>
          <button
            type="button"
            onClick={() => { void transcriptionActions.stop() }}
            disabled={!isTranscribing}
            title="Stop Transcription"
            className={stripActionClass(isTranscribing, "red")}
          >
            <StopCircleIcon className="size-3" />
            Stop mic
          </button>
        </div>
      </div>
    </section>
  )
}
