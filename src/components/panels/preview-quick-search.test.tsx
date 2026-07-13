// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PreviewQuickSearch } from "./preview-quick-search"
import type { Book } from "@/lib/quick-search"

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

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    loadBooks: vi.fn(),
    fetchVerse: vi.fn(),
  },
}))

vi.mock("@/stores/bible-store", () => ({
  useBibleStore: (
    selector: (state: { books: Book[]; activeTranslationId: number }) => unknown
  ) => selector({ books, activeTranslationId: 1 }),
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
