// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

const emitToMock = vi.hoisted(() => vi.fn())

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

describe("TextProperties", () => {
  let TextProperties: typeof import("./text-properties").TextProperties
  let useBroadcastStore: typeof import("@/stores/broadcast-store").useBroadcastStore
  let initialThemes: ReturnType<typeof useBroadcastStore.getState>["themes"]

  beforeAll(async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    ;({ useBroadcastStore } = await import("@/stores/broadcast-store"))
    initialThemes = [...useBroadcastStore.getState().themes]
    ;({ TextProperties } = await import("./text-properties"))
  })

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    emitToMock.mockResolvedValue(undefined)
    useBroadcastStore.setState({
      themes: [...initialThemes],
      draftTheme: null,
      selectedElement: null,
    })
  })

  it("shows a verse font style control for italic kinetic themes", () => {
    const desertCloth = initialThemes.find(
      (theme) => theme.id === "builtin-kinetic-desert-cloth"
    )
    expect(desertCloth).toBeTruthy()
    useBroadcastStore.setState({
      draftTheme: { ...desertCloth! },
      selectedElement: "verse",
    })

    render(<TextProperties />)

    expect(screen.getByText("Font Style")).toBeTruthy()
    expect(screen.getByText("Italic")).toBeTruthy()
  })
})
