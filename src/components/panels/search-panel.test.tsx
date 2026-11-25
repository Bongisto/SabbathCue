// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SearchPanel } from "./search-panel"
import { useBibleStore } from "@/stores/bible-store"
import type { Book, Translation, Verse } from "@/types"

const invokeTauriMock = vi.fn()
const scrollIntoPanelViewMock = vi.fn()
const selectPreviewVerseMock = vi.fn((verse: Verse) => {
  useBibleStore.getState().selectVerse(verse)
})

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
  invokeTauri: (...args: unknown[]) => invokeTauriMock(...args),
}))

vi.mock("@/lib/presentation-workflow", () => ({
  createScriptureQueueItem: vi.fn(),
  presentVerse: vi.fn(),
  selectPreviewVerse: (verse: Verse) => selectPreviewVerseMock(verse),
}))

vi.mock("@/lib/queue-flash", () => ({
  flashQueuedVerse: vi.fn(),
}))

vi.mock("@/lib/scroll-into-panel-view", () => ({
  scrollIntoPanelView: (...args: unknown[]) => scrollIntoPanelViewMock(...args),
}))

const TRANSLATIONS: Translation[] = [
  {
    id: 1,
    abbreviation: "KJV",
    title: "King James Version",
    language: "en",
    is_copyrighted: false,
    is_downloaded: true,
  },
  {
    id: 2,
    abbreviation: "WEB",
    title: "World English Bible",
    language: "en",
    is_copyrighted: false,
    is_downloaded: true,
  },
]

const BOOKS: Book[] = [
  {
    id: 1,
    translation_id: 1,
    book_number: 1,
    name: "Genesis",
    abbreviation: "Gen",
    testament: "OT",
  },
  {
    id: 43,
    translation_id: 1,
    book_number: 43,
    name: "John",
    abbreviation: "John",
    testament: "NT",
  },
]

const KJV_GEN_1: Verse[] = [
  {
    id: 1,
    translation_id: 1,
    book_number: 1,
    book_name: "Genesis",
    book_abbreviation: "Gen",
    chapter: 1,
    verse: 1,
    text: "In the beginning God created the heaven and the earth.",
  },
  {
    id: 16,
    translation_id: 1,
    book_number: 1,
    book_name: "Genesis",
    book_abbreviation: "Gen",
    chapter: 1,
    verse: 16,
    text: "And God made two great lights.",
  },
]

const WEB_GEN_1: Verse[] = [
  {
    id: 40001,
    translation_id: 2,
    book_number: 1,
    book_name: "Genesis",
    book_abbreviation: "Gen",
    chapter: 1,
    verse: 1,
    text: "In the beginning, God created the heavens and the earth.",
  },
  {
    id: 40016,
    translation_id: 2,
    book_number: 1,
    book_name: "Genesis",
    book_abbreviation: "Gen",
    chapter: 1,
    verse: 16,
    text: "God made the two great lights.",
  },
]

const KJV_JOHN_3_1: Verse = {
  id: 26122,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "John",
  chapter: 3,
  verse: 1,
  text: "There was a man of the Pharisees, named Nicodemus.",
}

const KJV_JOHN_3_16: Verse = {
  id: 26137,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "John",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world.",
}

const KJV_JOHN_3: Verse[] = [KJV_JOHN_3_1, KJV_JOHN_3_16]

describe("SearchPanel translation sync (FU-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    useBibleStore.setState({
      translations: TRANSLATIONS,
      activeTranslationId: 1,
      books: BOOKS,
      searchResults: [],
      semanticResults: [],
      selectedVerse: null,
      currentChapter: [],
      crossReferences: [],
      pendingNavigation: null,
    })

    invokeTauriMock.mockImplementation(
      async (command: string, args?: Record<string, unknown>) => {
        if (command === "list_translations") return TRANSLATIONS
        if (command === "list_books") return BOOKS
        if (command === "get_chapter") {
          const translationId = args?.translationId
          const bookNumber = args?.bookNumber
          const chapter = args?.chapter
          if (bookNumber === 1 && chapter === 1) {
            return translationId === 2 ? WEB_GEN_1 : KJV_GEN_1
          }
          if (bookNumber === 43 && chapter === 3) {
            return KJV_JOHN_3
          }
          return []
        }
        return undefined
      },
    )
  })

  afterEach(() => {
    cleanup()
  })

  it("syncs selectedVerse cleanly across KJV -> WEB -> KJV translation round-trips", async () => {
    render(<SearchPanel />)

    await waitFor(() => {
      expect(screen.getByText("Genesis 1:16")).toBeTruthy()
    })

    fireEvent.click(screen.getByText("Genesis 1:16"))
    expect(useBibleStore.getState().selectedVerse?.id).toBe(16)
    expect(document.getElementById("verse-16")?.className).toContain("bg-lime-500/10")

    act(() => {
      useBibleStore.getState().setActiveTranslation(2)
    })

    await waitFor(() => {
      expect(useBibleStore.getState().selectedVerse?.id).toBe(40016)
    })
    expect(document.getElementById("verse-40016")?.className).toContain("bg-lime-500/10")

    act(() => {
      useBibleStore.getState().setActiveTranslation(1)
    })

    await waitFor(() => {
      expect(useBibleStore.getState().selectedVerse?.id).toBe(16)
    })
    expect(document.getElementById("verse-16")?.className).toContain("bg-lime-500/10")
  })

  it("keeps Quick Search selectedVerse in another book untouched and unhighlighted on translation change", async () => {
    render(<SearchPanel />)

    await waitFor(() => {
      expect(screen.getByText("Genesis 1:16")).toBeTruthy()
    })

    fireEvent.click(screen.getByText("Genesis 1:16"))
    expect(useBibleStore.getState().selectedVerse?.id).toBe(16)

    // External Quick Search selects John 3:16 while SearchPanel remains on Genesis 1.
    act(() => {
      useBibleStore.getState().selectVerse(KJV_JOHN_3_16)
    })
    selectPreviewVerseMock.mockClear()

    act(() => {
      useBibleStore.getState().setActiveTranslation(2)
    })

    await waitFor(() => {
      expect(screen.getByText("God made the two great lights.")).toBeTruthy()
    })

    expect(selectPreviewVerseMock).not.toHaveBeenCalled()
    expect(useBibleStore.getState().selectedVerse).toEqual(KJV_JOHN_3_16)
    expect(document.getElementById("verse-40016")?.className).not.toContain(
      "bg-lime-500/10",
    )
  })

  it("processes pre-existing pendingNavigation on mount, avoids loadBooks overwrite, and scrolls post-render (FU-43)", async () => {
    let resolveBooks!: (books: Book[]) => void
    const deferredBooks = new Promise<Book[]>((resolve) => {
      resolveBooks = resolve
    })
    invokeTauriMock.mockImplementation(
      async (command: string, args?: Record<string, unknown>) => {
        if (command === "list_translations") return TRANSLATIONS
        if (command === "list_books") return deferredBooks
        if (command === "get_chapter" && args?.bookNumber === 43 && args?.chapter === 3) {
          return KJV_JOHN_3
        }
        return []
      },
    )

    useBibleStore.setState({
      books: BOOKS,
      pendingNavigation: { bookNumber: 43, chapter: 3, verse: 16 },
    })

    render(<SearchPanel />)

    await waitFor(() => {
      expect(screen.getByText("John 3:16")).toBeTruthy()
    })
    expect(scrollIntoPanelViewMock).toHaveBeenCalledTimes(1)
    const scrolledEl = scrollIntoPanelViewMock.mock.calls[0]?.[0] as HTMLElement | null
    expect(scrolledEl?.id).toBe("verse-26137")
    expect(scrolledEl?.isConnected).toBe(true)

    // Delayed loadBooks resolution must not overwrite the navigated book back to Genesis 1.
    await act(async () => {
      resolveBooks(BOOKS)
      await Promise.resolve()
    })

    expect(screen.getByText("John 3")).toBeTruthy()
    expect(screen.queryByText("Genesis 1")).toBeNull()
    expect(useBibleStore.getState().selectedVerse?.id).toBe(26137)
    expect(useBibleStore.getState().pendingNavigation).toBeNull()
  })

  it("cancels in-flight pendingNavigation on unmount without clearing pendingNavigation (FU-43)", async () => {
    let resolveChapter!: (verses: Verse[]) => void
    const deferredChapter = new Promise<Verse[]>((resolve) => {
      resolveChapter = resolve
    })
    invokeTauriMock.mockImplementation(
      async (command: string, args?: Record<string, unknown>) => {
        if (command === "list_translations") return TRANSLATIONS
        if (command === "list_books") return BOOKS
        if (command === "get_chapter" && args?.bookNumber === 1 && args?.chapter === 1) {
          return KJV_GEN_1
        }
        if (command === "get_chapter" && args?.bookNumber === 43 && args?.chapter === 3) {
          return deferredChapter
        }
        return []
      },
    )

    const view = render(<SearchPanel />)
    await waitFor(() => {
      expect(screen.getByText("Genesis 1:16")).toBeTruthy()
    })
    selectPreviewVerseMock.mockClear()

    act(() => {
      useBibleStore.getState().setPendingNavigation({ bookNumber: 43, chapter: 3, verse: 16 })
    })

    view.unmount()

    await act(async () => {
      resolveChapter(KJV_JOHN_3)
      await Promise.resolve()
    })

    expect(selectPreviewVerseMock).not.toHaveBeenCalled()
    expect(useBibleStore.getState().pendingNavigation).toEqual({
      bookNumber: 43,
      chapter: 3,
      verse: 16,
    })
  })
})
