// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const fetchVerseMock = vi.fn()
const selectVerseMock = vi.fn()
const setPreviewItemMock = vi.fn()
const setLiveItemMock = vi.fn()
const setLiveMock = vi.fn()

let previewItem: unknown = null
let selectedVerse: unknown = null

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasPresentation: () => React.createElement("div", { "data-testid": "canvas-presentation" }),
}))

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    fetchVerse: (...args: unknown[]) => fetchVerseMock(...args),
    selectVerse: (...args: unknown[]) => selectVerseMock(...args),
  },
}))

vi.mock("@/stores/bible-store", () => {
  const useBibleStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeTranslationId: 1,
      selectedVerse,
    })
  useBibleStore.getState = () => ({
    selectedVerse,
    selectVerse: selectVerseMock,
  })
  return { useBibleStore }
})

vi.mock("@/stores/broadcast-store", () => {
  const useBroadcastStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      previewItem,
      themes: [],
      activeThemeId: "",
      isLive: false,
      readingModeAutoLive: false,
    })
  const selectActiveTheme = (state: { themes: Array<{ id: string }>; activeThemeId: string }) =>
    state.themes.find((theme) => theme.id === state.activeThemeId) ?? state.themes[0] ?? null
  useBroadcastStore.getState = () => ({
    previewItem,
    setPreviewItem: setPreviewItemMock,
    setLiveItem: setLiveItemMock,
    setLive: setLiveMock,
  })
  return { selectActiveTheme, useBroadcastStore }
})

describe("PreviewPanel", () => {
  let PreviewPanel: typeof import("./preview-panel").PreviewPanel
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ PreviewPanel } = await import("./preview-panel"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    previewItem = null
    selectedVerse = null
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
  })

  async function renderPanel() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(PreviewPanel))
    })
  }

  it("does not replace a staged hymn preview when scripture translation changes", async () => {
    previewItem = {
      kind: "hymn",
      reference: "Hymn 12",
      segments: [{ text: "A hymn line" }],
    }
    selectedVerse = {
      book_number: 43,
      chapter: 3,
      verse: 16,
    }

    await renderPanel()

    expect(fetchVerseMock).not.toHaveBeenCalled()
    expect(setPreviewItemMock).not.toHaveBeenCalled()
  })
})
