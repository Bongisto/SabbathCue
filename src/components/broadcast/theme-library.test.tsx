// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasVerse: ({ theme }: { theme: { name: string } }) =>
    React.createElement("div", { "data-testid": "theme-thumbnail" }, theme.name),
}))

vi.mock("@/lib/theme-designer-files", () => ({
  importTheme: vi.fn(),
  exportTheme: vi.fn(),
}))

describe("ThemeLibrary", () => {
  let ThemeLibrary: typeof import("./theme-library").ThemeLibrary
  let useBroadcastStore: typeof import("@/stores/broadcast-store").useBroadcastStore
  let initialThemes: ReturnType<typeof useBroadcastStore.getState>["themes"]
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ useBroadcastStore } = await import("@/stores/broadcast-store"))
    initialThemes = [...useBroadcastStore.getState().themes]
    ;({ ThemeLibrary } = await import("./theme-library"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    emitToMock.mockResolvedValue(undefined)
    useBroadcastStore.setState({
      themes: [...initialThemes],
      activeThemeId: initialThemes[0].id,
      editingThemeId: null,
      draftTheme: null,
      renamingThemeId: null,
    })
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

  async function renderLibrary() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(ThemeLibrary))
    })
  }

  function getThemeCard(themeName: string): HTMLDivElement {
    const card = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? [],
    ).find((element) => element.textContent?.includes(themeName))

    expect(card).toBeTruthy()
    return card as HTMLDivElement
  }

  it("activates the theme when a theme card is selected", async () => {
    const nextTheme = initialThemes[1]

    await renderLibrary()

    await act(async () => {
      getThemeCard(nextTheme.name).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      )
    })

    expect(useBroadcastStore.getState().activeThemeId).toBe(nextTheme.id)
    expect(useBroadcastStore.getState().editingThemeId).toBe(nextTheme.id)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({ id: nextTheme.id }),
      }),
    )
  })
})
