// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasVerse: ({ theme }: { theme: { name: string } }) =>
    React.createElement(
      "div",
      { "data-testid": "theme-thumbnail" },
      theme.name
    ),
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
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).find((element) => element.textContent?.includes(themeName))

    expect(card).toBeTruthy()
    return card as HTMLDivElement
  }

  it("activates the theme when a theme card is selected", async () => {
    const nextTheme = initialThemes[1]

    await renderLibrary()

    await act(async () => {
      getThemeCard(nextTheme.name).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })

    expect(useBroadcastStore.getState().activeThemeId).toBe(nextTheme.id)
    expect(useBroadcastStore.getState().editingThemeId).toBe(nextTheme.id)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({ id: nextTheme.id }),
      })
    )
  })

  it("selecting a kinetic preset activates it and emits kinetic metadata", async () => {
    const kinetic = initialThemes.find((t) => t.kinetic)
    expect(kinetic).toBeTruthy()

    await renderLibrary()

    await act(async () => {
      getThemeCard(kinetic!.name).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })

    expect(useBroadcastStore.getState().activeThemeId).toBe(kinetic!.id)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({
          id: kinetic!.id,
          kinetic: expect.objectContaining({ source: "html-prototype-v2" }),
        }),
      })
    )
  })

  it("renders a dedicated kinetic section with the kinetic filter tab", async () => {
    const kineticThemes = initialThemes.filter((t) => t.kinetic)
    expect(kineticThemes.length).toBeGreaterThanOrEqual(14)

    await renderLibrary()

    // The kinetic filter tab exists as its own selection workflow.
    const kineticTab = Array.from(
      container?.querySelectorAll("button") ?? []
    ).find((b) => b.textContent?.trim().toLowerCase() === "kinetic")
    expect(kineticTab).toBeTruthy()

    // A dedicated "Kinetic Motion" section header is present.
    const headers = Array.from(container?.querySelectorAll("p") ?? []).map(
      (p) => p.textContent ?? ""
    )
    expect(headers.some((t) => t.includes("Kinetic Motion"))).toBe(true)

    // Every kinetic preset renders as a card.
    const texts = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).map((c) => c.textContent ?? "")
    for (const theme of kineticThemes) {
      expect(texts.some((t) => t.includes(theme.name))).toBe(true)
    }
  })

  it("shows kinetic presets before the long built-in theme list", async () => {
    await renderLibrary()

    const headings = Array.from(container?.querySelectorAll("p") ?? []).map(
      (p) => p.textContent ?? ""
    )
    const kineticIndex = headings.findIndex((text) =>
      text.includes("Kinetic Motion")
    )
    const builtInIndex = headings.findIndex((text) => text.includes("Built-in"))

    expect(kineticIndex).toBeGreaterThanOrEqual(0)
    expect(builtInIndex).toBeGreaterThanOrEqual(0)
    expect(kineticIndex).toBeLessThan(builtInIndex)
  })

  it("renders custom kinetic themes only once in the kinetic section", async () => {
    const kinetic = initialThemes.find((t) => t.kinetic)
    expect(kinetic).toBeTruthy()
    const customKinetic = {
      ...kinetic!,
      id: "custom-kinetic-theme",
      name: "Custom Kinetic Theme",
      builtin: false,
    }
    useBroadcastStore.setState({
      themes: [...initialThemes, customKinetic],
    })

    await renderLibrary()

    const matchingCards = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).filter((card) => card.textContent?.includes(customKinetic.name))
    expect(matchingCards).toHaveLength(1)
  })

  it("keeps inline rename focused when opened from menu and stops Escape/Enter propagation (FU-38)", async () => {
    const customTheme = {
      ...initialThemes[0],
      id: "custom-rename-theme",
      name: "My Custom Theme",
      builtin: false,
      kinetic: undefined,
    }
    useBroadcastStore.setState({
      themes: [...initialThemes, customTheme],
    })

    const parentKeyDown = vi.fn()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        React.createElement("div", { onKeyDown: parentKeyDown }, React.createElement(ThemeLibrary))
      )
    })

    const card = getThemeCard("My Custom Theme")
    const trigger = card.querySelector("button")
    expect(trigger).toBeTruthy()

    // Open Radix dropdown menu via keyboard and click Rename
    await act(async () => {
      trigger!.focus()
      trigger!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      )
    })

    const renameItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (item) => item.textContent?.includes("Rename")
    ) as HTMLElement | undefined
    expect(renameItem).toBeTruthy()

    await act(async () => {
      renameItem!.click()
    })
    // Allow any Radix async focus-restore timers to flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })

    expect(useBroadcastStore.getState().renamingThemeId).toBe("custom-rename-theme")
    const input = card.querySelector("input")
    expect(input).toBeTruthy()
    expect(document.activeElement).toBe(input)

    // Escape cancels rename without propagating to parent dialog
    parentKeyDown.mockClear()
    await act(async () => {
      input!.value = "Discarded Name"
      input!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      )
    })

    expect(parentKeyDown).not.toHaveBeenCalled()
    expect(useBroadcastStore.getState().renamingThemeId).toBeNull()
    expect(
      useBroadcastStore.getState().themes.find((t) => t.id === "custom-rename-theme")?.name
    ).toBe("My Custom Theme")

    // Re-open rename and press Enter to commit without bubbling
    await act(async () => {
      useBroadcastStore.getState().setRenamingTheme("custom-rename-theme")
    })
    const input2 = card.querySelector("input")
    expect(input2).toBeTruthy()

    parentKeyDown.mockClear()
    await act(async () => {
      input2!.value = "Renamed Theme"
      input2!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      )
    })

    expect(parentKeyDown).not.toHaveBeenCalled()
    expect(useBroadcastStore.getState().renamingThemeId).toBeNull()
    expect(
      useBroadcastStore.getState().themes.find((t) => t.id === "custom-rename-theme")?.name
    ).toBe("Renamed Theme")
  })
})
