// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CONTEXT_SEARCH_DEBOUNCE_MS,
  CONTEXT_SEARCH_TRANSLATION_DEBOUNCE_MS,
  runContextVerseSearch,
  useContextVerseSearch,
} from "./use-context-verse-search"
import { useBibleStore } from "@/stores/bible-store"
import type { SemanticSearchResult } from "@/types"

const mockInvoke = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/lib/context-search", () => ({
  mergeContextSearchResults: (primary: SemanticSearchResult[]) => primary,
  searchContextWithFuse: vi.fn().mockResolvedValue([]),
}))

const backendResult: SemanticSearchResult = {
  verse_ref: "John 3:16",
  verse_text: "backend result",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  similarity: 0.72,
}

const fuseResult: SemanticSearchResult = {
  verse_ref: "John 3:16",
  verse_text: "fuse result",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  similarity: 0.91,
}

describe("runContextVerseSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("merges hybrid and fuse results when both succeed", async () => {
    const invoke = vi.fn().mockResolvedValue([backendResult])
    const importContextSearch = vi.fn().mockResolvedValue({
      mergeContextSearchResults: (
        primary: SemanticSearchResult[],
        fallback: SemanticSearchResult[],
      ) => [...primary, ...fallback],
      searchContextWithFuse: vi.fn().mockResolvedValue([fuseResult]),
    })
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch,
      setSemanticResults,
      isStale: () => false,
    })

    expect(invoke).toHaveBeenCalledWith("semantic_search", {
      query: "loved the world",
      limit: 15,
    })
    expect(setSemanticResults).toHaveBeenCalledWith([backendResult, fuseResult])
  })

  it("uses backend results when the fuse module fails to import", async () => {
    const invoke = vi.fn().mockResolvedValue([backendResult])
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue(null),
      setSemanticResults,
      isStale: () => false,
    })

    expect(setSemanticResults).toHaveBeenCalledWith([backendResult])
  })

  it("suppresses stale responses", async () => {
    const invoke = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([backendResult]), 20)
          }),
      )
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("loved the world", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue({
        mergeContextSearchResults: vi.fn(),
        searchContextWithFuse: vi.fn(),
      }),
      setSemanticResults,
      isStale: () => true,
    })

    expect(setSemanticResults).not.toHaveBeenCalled()
  })

  it("falls back to an empty list when semantic search fails and fuse import fails", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("offline"))
    const setSemanticResults = vi.fn()

    await runContextVerseSearch("grace", 1, {
      invoke,
      importContextSearch: vi.fn().mockResolvedValue(null),
      setSemanticResults,
      isStale: () => false,
    })

    expect(setSemanticResults).toHaveBeenCalledWith([])
  })
})

describe("useContextVerseSearch hook (FL-20)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBibleStore.setState({ activeTranslationId: 1, semanticResults: [] })
  })

  it("keeps the 280ms typing debounce instead of overriding with 120ms", async () => {
    vi.useFakeTimers()
    mockInvoke.mockResolvedValue([backendResult])

    const { result, unmount } = renderHook(() =>
      useContextVerseSearch({ activeTab: "context", activeTranslationId: 1 }),
    )

    act(() => {
      result.current.handleContextSearch("for god so loved")
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTEXT_SEARCH_TRANSLATION_DEBOUNCE_MS + 10)
    })
    expect(mockInvoke).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        CONTEXT_SEARCH_DEBOUNCE_MS - CONTEXT_SEARCH_TRANSLATION_DEBOUNCE_MS,
      )
      await Promise.resolve()
    })
    expect(mockInvoke).toHaveBeenCalledTimes(1)

    unmount()
    vi.useRealTimers()
  })

  it("cancels pending timers, ignores in-flight results, and clears semanticResults in clearContextQuery", async () => {
    vi.useFakeTimers()
    let resolveSearch!: (value: SemanticSearchResult[]) => void
    mockInvoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve
        }),
    )

    useBibleStore.setState({ semanticResults: [backendResult] })
    const { result, unmount } = renderHook(() =>
      useContextVerseSearch({ activeTab: "context", activeTranslationId: 1 }),
    )

    act(() => {
      result.current.handleContextSearch("shepherd")
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTEXT_SEARCH_DEBOUNCE_MS)
    })
    expect(mockInvoke).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.clearContextQuery()
    })
    expect(result.current.contextQuery).toBe("")
    expect(useBibleStore.getState().semanticResults).toEqual([])

    await act(async () => {
      resolveSearch([backendResult])
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useBibleStore.getState().semanticResults).toEqual([])

    unmount()
    vi.useRealTimers()
  })
})
