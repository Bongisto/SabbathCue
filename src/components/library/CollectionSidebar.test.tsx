// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useLibraryStore } from "@/stores/library-store"
import { CollectionSidebar, type LibraryFilter } from "./CollectionSidebar"

vi.mock("@/lib/library/library-persistence", () => ({
  loadLibrarySnapshot: vi
    .fn()
    .mockResolvedValue({ assets: [], collections: [] }),
  saveLibrarySnapshot: vi.fn().mockResolvedValue(undefined),
}))

describe("CollectionSidebar (FU-18, FU-34)", () => {
  beforeEach(() => {
    useLibraryStore.setState({
      assets: [],
      collections: [
        {
          id: "col-1",
          name: "Easter",
          assetIds: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("includes Videos type filter and resets filter to all when deleting active collection (FU-34)", () => {
    const onFilterChange = vi.fn<(filter: LibraryFilter) => void>()
    render(
      <CollectionSidebar
        filter="collection:col-1"
        onFilterChange={onFilterChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Videos" }))
    expect(onFilterChange).toHaveBeenCalledWith("video")

    fireEvent.click(screen.getByRole("button", { name: "Delete Easter" }))
    expect(onFilterChange).toHaveBeenCalledWith("all")
    expect(useLibraryStore.getState().collections).toHaveLength(0)
  })

  it("buffers collection rename edits in draft state and commits on Enter or blur (FU-18)", () => {
    const onFilterChange = vi.fn()
    render(<CollectionSidebar filter="all" onFilterChange={onFilterChange} />)

    const input = screen.getByLabelText("Rename Easter") as HTMLInputElement
    fireEvent.change(input, { target: { value: "Easter " } })
    // Spaces and intermediate edits are preserved in draft without mutating store yet
    expect(input.value).toBe("Easter ")
    expect(useLibraryStore.getState().collections[0]?.name).toBe("Easter")

    fireEvent.change(input, { target: { value: "" } })
    expect(input.value).toBe("")
    fireEvent.blur(input)
    // Empty draft reverts to existing name rather than failing silently or staying blank
    expect(useLibraryStore.getState().collections[0]?.name).toBe("Easter")
    expect(input.value).toBe("Easter")

    fireEvent.change(input, { target: { value: "  Good Friday  " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(useLibraryStore.getState().collections[0]?.name).toBe("Good Friday")
  })
})
