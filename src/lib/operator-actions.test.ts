import { beforeEach, describe, expect, it, vi } from "vitest"
import { toggleTranscription } from "./operator-actions"
import { useTranscriptStore } from "@/stores/transcript-store"
import { transcriptionActions } from "@/hooks/use-transcription"

vi.mock("@/hooks/use-transcription", () => ({
  transcriptionActions: {
    start: vi.fn().mockResolvedValue(true),
    stop: vi.fn().mockResolvedValue(undefined),
  },
}))

describe("toggleTranscription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTranscriptStore.setState({
      isTranscribing: false,
      connectionStatus: "disconnected",
    })
  })

  it("ignores duplicate start triggers while connecting", () => {
    useTranscriptStore.setState({
      isTranscribing: false,
      connectionStatus: "connecting",
    })

    toggleTranscription()

    expect(transcriptionActions.start).not.toHaveBeenCalled()
    expect(transcriptionActions.stop).not.toHaveBeenCalled()
  })

  it("stops active transcription and starts idle transcription", () => {
    toggleTranscription()
    expect(transcriptionActions.start).toHaveBeenCalledTimes(1)

    useTranscriptStore.setState({ isTranscribing: true })
    toggleTranscription()
    expect(transcriptionActions.stop).toHaveBeenCalledTimes(1)
  })
})
