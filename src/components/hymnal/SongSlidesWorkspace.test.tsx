// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { SongSlidesWorkspace } from "./SongSlidesWorkspace"

const toastErrorMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

describe("SongSlidesWorkspace (FU-48)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders repeated lyric lines with composite keys and high-contrast text-neutral-50 on bg-black", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { container } = render(<SongSlidesWorkspace />)

    const textarea = container.querySelector("textarea")!
    fireEvent.change(textarea, {
      target: { value: "Holy\nHoly\nHoly" },
    })

    const previewTexts = container.querySelectorAll(".bg-black p")
    expect(previewTexts).toHaveLength(3)
    expect(container.querySelector(".bg-black .text-neutral-50")).toBeTruthy()
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some((arg) => String(arg).includes("same key")),
      ),
    ).toBe(false)
  })

  it("handles file.text() rejections with toast.error and resets input value", async () => {
    const { container } = render(<SongSlidesWorkspace />)
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!

    const badFile = new File(["broken"], "song.txt", { type: "text/plain" })
    Object.defineProperty(badFile, "text", {
      value: vi.fn().mockRejectedValue(new Error("Unreadable file")),
    })

    Object.defineProperty(fileInput, "files", {
      value: [badFile],
      configurable: true,
    })
    fireEvent.change(fileInput)

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Unreadable file"),
    )
    expect(fileInput.value).toBe("")
  })
})
