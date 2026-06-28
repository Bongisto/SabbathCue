import { create } from "zustand"
import type { TranscriptSegment } from "@/types"
import type { SttProvider } from "@/stores/settings-store"

const MAX_TRANSCRIPT_SEGMENTS = 100

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
    set((state) => ({
      segments: [...state.segments, segment].slice(-MAX_TRANSCRIPT_SEGMENTS),
      currentPartial: "",
      lastIssue: null,
    })),
  setPartial: (currentPartial) => set({ currentPartial }),
  setTranscribing: (isTranscribing) => set({ isTranscribing }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setIssue: (lastIssue) => set({ lastIssue }),
  clearIssue: () => set({ lastIssue: null }),
  clearTranscript: () => set({ segments: [], currentPartial: "" }),
}))
