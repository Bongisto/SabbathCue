import { create } from "zustand"
import type { TranscriptSegment } from "@/types"
import type { SttProvider } from "@/stores/settings-store"

const MAX_TRANSCRIPT_SEGMENTS = 100
export const SPEECHMATICS_COALESCE_GAP_MS = 4_000

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"
export type TranscriptionIssueKind =
  | "missing_api_key"
  | "billing"
  | "auth"
  | "network"
  | "model_missing"
  | "provider"
  | "unknown"

export interface TranscriptionIssue {
  kind: TranscriptionIssueKind
  provider: SttProvider
  title: string
  description: string
  actionLabel?: string
}

interface TranscriptState {
  segments: TranscriptSegment[]
  currentPartial: string
  isTranscribing: boolean
  connectionStatus: ConnectionStatus
  lastIssue: TranscriptionIssue | null

  addSegment: (segment: TranscriptSegment) => void
  setPartial: (text: string) => void
  setTranscribing: (transcribing: boolean) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setIssue: (issue: TranscriptionIssue) => void
  clearIssue: () => void
  clearTranscript: () => void
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  segments: [],
  currentPartial: "",
  isTranscribing: false,
  connectionStatus: "disconnected",
  lastIssue: null,

  addSegment: (segment) =>
    set((state) => {
      const previous = state.segments.at(-1)
      const gapMs = previous ? segment.timestamp - previous.timestamp : -1
      const coalesceSpeechmatics =
        previous?.provider === "speechmatics" &&
        segment.provider === "speechmatics" &&
        gapMs >= 0 &&
        gapMs <= SPEECHMATICS_COALESCE_GAP_MS

      if (previous && coalesceSpeechmatics) {
        const previousWeight = Math.max(1, previous.words.length)
        const segmentWeight = Math.max(1, segment.words.length)
        const merged: TranscriptSegment = {
          ...segment,
          id: previous.id,
          text: `${previous.text.trimEnd()} ${segment.text.trimStart()}`,
          confidence:
            (previous.confidence * previousWeight +
              segment.confidence * segmentWeight) /
            (previousWeight + segmentWeight),
          words: [...previous.words, ...segment.words],
        }
        return {
          segments: [...state.segments.slice(0, -1), merged],
          currentPartial: "",
          lastIssue: null,
        }
      }

      return {
        segments: [...state.segments, segment].slice(-MAX_TRANSCRIPT_SEGMENTS),
        currentPartial: "",
        lastIssue: null,
      }
    }),
  setPartial: (currentPartial) => set({ currentPartial }),
  setTranscribing: (isTranscribing) => set({ isTranscribing }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setIssue: (lastIssue) => set({ lastIssue }),
  clearIssue: () => set({ lastIssue: null }),
  clearTranscript: () => set({ segments: [], currentPartial: "" }),
}))
