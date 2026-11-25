// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PreviewQuickSearch } from "./preview-quick-search"
import type { Book } from "@/lib/quick-search"
import { bibleActions } from "@/hooks/use-bible"
import { loadHymnVoiceControl } from "@/services/hymnal/hymn-voice-control-loader"
import { searchHymns } from "@/services/hymnal/hymnal-repository"
import { invokeTauri } from "@/lib/tauri-runtime"

const books: Book[] = [
  {
    id: 43,
    translation_id: 1,
    book_number: 43,
    name: "John",
    abbreviation: "John",
    testament: "NT",
  },
  {
    id: 62,
    translation_id: 1,
    book_number: 62,
    name: "I John",
    abbreviation: "1John",
    testament: "NT",
  },
]

const storeState = vi.hoisted(() => ({
  books: [] as Book[],
  activeTranslationId: 1,
}))

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    loadBooks: vi.fn(async () => books),
    fetchVerse: vi.fn(),
  },
}))

vi.mock("@/stores/bible-store", () => ({
  useBibleStore: (
    selector: (state: { books: Book[]; activeTranslationId: number }) => unknown
  ) => selector(storeState),
}))

vi.mock("@/stores/library-store", () => ({
  useLibraryStore: (selector: (state: { assets: unknown[] }) => unknown) =>
    selector({ assets: [] }),
}))

vi.mock("@/lib/presentation-workflow", () => ({
  egwReference: vi.fn(() => "EGW reference"),
  previewEgwParagraph: vi.fn(),
  selectPreviewVerse: vi.fn(),
}))

vi.mock("@/lib/library/library-presentation", () => ({
  isPresentableLibraryAsset: vi.fn(() => false),
  previewLibraryAsset: vi.fn(),
}))

vi.mock("@/services/hymnal/hymnal-repository", () => ({
  searchHymns: vi.fn(() => []),
}))

vi.mock("@/services/hymnal/hymn-voice-control-loader", () => ({
  loadHymnVoiceControl: vi.fn(),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: vi.fn(async () => []),
}))

beforeEach(() => {
  vi.clearAllMocks()
  storeState.books = books
  vi.mocked(searchHymns).mockReturnValue([])
  vi.mocked(invokeTauri).mockResolvedValue([])
})

afterEach(() => cleanup())

describe("PreviewQuickSearch ghost suggestion", () => {
  it("does not render ghost text for normalized mismatches", () => {
    render(<PreviewQuickSearch />)

    fireEvent.change(screen.getByPlaceholderText(/quick preview/i), {
      target: { value: "1 j" },
    })

    expect(screen.queryByTestId("quick-search-ghost")).toBeNull()
  })

  it("renders suffix ghost text for prefix matches and removes it when cleared", () => {
    render(<PreviewQuickSearch />)

    const input = screen.getByPlaceholderText(/quick preview/i)
    fireEvent.change(input, { target: { value: "jo" } })
    expect(screen.getByTestId("quick-search-ghost").textContent).toContain(
      "hn 1:1"
    )

    fireEvent.change(input, { target: { value: "" } })
    expect(screen.queryByTestId("quick-search-ghost")).toBeNull()
  })
})

describe("PreviewQuickSearch error handling, Escape, and popover surface (FU-44)", () => {
  it("clears stuck Previewing feedback when fetchVerse or previewHymn rejects", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(bibleActions.fetchVerse).mockRejectedValueOnce(new Error("db error"))

    render(<PreviewQuickSearch />)
    const input = screen.getByPlaceholderText(/quick preview/i)
    fireEvent.change(input, { target: { value: "John 3:16" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(screen.getByText("Failed to preview verse")).toBeTruthy()
    })

    vi.mocked(searchHymns).mockReturnValue([
      { id: "sda-46", number: 46, title: "Holy, Holy, Holy" },
    ])
    vi.mocked(loadHymnVoiceControl).mockRejectedValueOnce(new Error("chunk failed"))

    fireEvent.change(input, { target: { value: "hymn 46" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(screen.getByText("Failed to preview hymn 46")).toBeTruthy()
    })
    errSpy.mockRestore()
  })

  it("handles mount loadBooks failure without unhandled rejection", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    storeState.books = []
    vi.mocked(bibleActions.loadBooks).mockRejectedValueOnce(new Error("init failed"))

    render(<PreviewQuickSearch />)

    await waitFor(() => {
      expect(errSpy).toHaveBeenCalled()
    })
    errSpy.mockRestore()
  })

  it("clears egwMatches on Escape and uses semantic elevated surface classes", async () => {
    vi.mocked(invokeTauri).mockImplementation(async (cmd: string) => {
      if (cmd === "egw_search") {
        return [
          {
            id: 1,
            book_number: 2,
            book_title: "Steps to Christ",
            chapter: 1,
            chapter_title: "Love",
            paragraph: 1,
            page: 9,
            page_paragraph: 1,
            text: "God is love",
          },
        ]
      }
      return []
    })

    render(<PreviewQuickSearch />)
    const input = screen.getByPlaceholderText(/quick preview/i)
    fireEvent.change(input, { target: { value: "love" } })

    const egwButton = await screen.findByText("EGW reference")
    const dropdown = egwButton.closest("div")
    expect(dropdown?.className).toContain("bg-[var(--bg-elevated)]")
    expect(dropdown?.className).toContain("text-foreground")
    expect(dropdown?.className).not.toContain("bg-[rgba(2,3,7,0.95)]")

    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByText("EGW reference")).toBeNull()

    // Typing a short non-matching query before debounce completes should not resurrect stale EGW matches.
    fireEvent.change(input, { target: { value: "x" } })
    expect(screen.queryByText("EGW reference")).toBeNull()
  })
})
