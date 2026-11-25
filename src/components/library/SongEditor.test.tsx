// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useLibraryStore } from "@/stores/library-store"
import { SongEditor } from "./SongEditor"

vi.mock("@/lib/library/library-persistence", () => ({
  loadLibrarySnapshot: vi
    .fn()
    .mockResolvedValue({ assets: [], collections: [] }),
  saveLibrarySnapshot: vi.fn().mockResolvedValue(undefined),
}))

describe("SongEditor", () => {
  beforeEach(() => {
    useLibraryStore.setState({ assets: [], collections: [] })
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000101",
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("saves pasted song text as a library song asset", () => {
    const onClose = vi.fn()
    render(<SongEditor onClose={onClose} />)

    fireEvent.change(screen.getByDisplayValue("Custom Song"), {
      target: { value: "Blessed Assurance" },
    })
    fireEvent.change(screen.getByDisplayValue(/Amazing grace/), {
      target: { value: "Blessed assurance\nJesus is mine" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save song/i }))

    expect(useLibraryStore.getState().assets[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000101",
      name: "Blessed Assurance",
      type: "song",
      song: {
        title: "Blessed Assurance",
        sections: [
          {
            kind: "verse",
            index: 1,
            lines: ["Blessed assurance", "Jesus is mine"],
          },
        ],
      },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it("renders repeated lyric lines without duplicate React key warnings (FU-48)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<SongEditor onClose={vi.fn()} />)

    fireEvent.change(screen.getByDisplayValue(/Amazing grace/), {
      target: { value: "Hallelujah\nHallelujah\nAmen" },
    })

    expect(screen.getAllByText("Hallelujah")).toHaveLength(2)
    expect(
      errorSpy.mock.calls.some((args) =>
        args.some((arg) => String(arg).includes("same key"))
      )
    ).toBe(false)
  })
})
