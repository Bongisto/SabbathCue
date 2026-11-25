import { beforeEach, describe, expect, it } from "vitest"
import {
  formatApiKeyPromptCopy,
  openApiKeyPrompt,
  useApiKeyPromptStore,
} from "./api-key-prompt"

describe("api-key-prompt", () => {
  beforeEach(() => {
    useApiKeyPromptStore.setState({ isOpen: false, provider: "deepgram" })
  })

  it("tracks the requested STT provider and formats dynamic copy", () => {
    openApiKeyPrompt("soniox")
    expect(useApiKeyPromptStore.getState()).toMatchObject({
      isOpen: true,
      provider: "soniox",
    })
    expect(formatApiKeyPromptCopy("soniox")).toEqual({
      service: "Soniox",
      description:
        "Live transcription needs a Soniox API key. Add it in settings so the app can start listening.",
    })

    openApiKeyPrompt("speechmatics")
    expect(useApiKeyPromptStore.getState().provider).toBe("speechmatics")
    expect(formatApiKeyPromptCopy("speechmatics")).toEqual({
      service: "Speechmatics",
      description:
        "Live transcription needs a Speechmatics API key. Add it in settings so the app can start listening.",
    })
  })
})
