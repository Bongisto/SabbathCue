// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useApiKeySettings } from "./use-api-key-settings"

describe("useApiKeySettings", () => {
  it("preserves hasKey=true when saving fails with an error", async () => {
    const setHasKey = vi.fn()
    const onSaved = vi.fn()
    const save = vi.fn().mockResolvedValue({
      hasKey: false,
      error: "API key cannot be empty",
    })

    const { result } = renderHook(() =>
      useApiKeySettings({
        hasKey: true,
        setHasKey,
        save,
        clear: vi.fn().mockResolvedValue({}),
        validate: vi.fn().mockResolvedValue({ valid: true }),
        onSaved,
      }),
    )

    await act(async () => {
      await result.current.handleKeyAction()
    })
    expect(result.current.editingSavedKey).toBe(true)

    await act(async () => {
      await result.current.handleKeyAction()
    })

    expect(setHasKey).not.toHaveBeenCalled()
    expect(result.current.keyError).toBe("API key cannot be empty")
    expect(onSaved).not.toHaveBeenCalled()
  })
})
