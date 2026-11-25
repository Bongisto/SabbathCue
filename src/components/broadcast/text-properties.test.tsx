// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

const emitToMock = vi.hoisted(() => vi.fn())

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

describe("TextProperties", () => {
  let TextProperties: typeof import("./text-properties").TextProperties
  let parseColorOpacity: typeof import("./text-properties").parseColorOpacity
  let buildColorWithOpacity: typeof import("./text-properties").buildColorWithOpacity
  let HexColorInput: typeof import("./text-properties").HexColorInput
  let BoundedNumberInput: typeof import("./text-properties").BoundedNumberInput
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
    ;({
      TextProperties,
      parseColorOpacity,
      buildColorWithOpacity,
      HexColorInput,
      BoundedNumberInput,
    } = await import("./text-properties"))
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

  it("parses and builds rgb/rgba, transparent, and 3/6/8-digit hex colors safely", () => {
    expect(parseColorOpacity("rgba(0,0,0,0.8)")).toEqual({
      hex: "#000000",
      opacity: 80,
    })
    expect(parseColorOpacity("transparent")).toEqual({
      hex: "#000000",
      opacity: 0,
    })
    expect(parseColorOpacity("#fff")).toEqual({
      hex: "#ffffff",
      opacity: 100,
    })
    expect(parseColorOpacity("#11223380")).toEqual({
      hex: "#112233",
      opacity: 50,
    })
    expect(parseColorOpacity("rgb(17, 34, 51)")).toEqual({
      hex: "#112233",
      opacity: 100,
    })
    expect(buildColorWithOpacity("rgba(0,0,0,0.8)", 50)).toBe("#00000080")
    expect(buildColorWithOpacity("transparent", 50)).toBe("#00000080")
    expect(buildColorWithOpacity("#fff", 50)).toBe("#ffffff80")
    expect(buildColorWithOpacity("#11223380", 100)).toBe("#112233")
  })

  it("buffers intermediate hex and font-size edits and reverts invalid drafts on blur", () => {
    const onHexCommit = vi.fn()
    const { rerender } = render(
      <HexColorInput value="#ffffff" onCommit={onHexCommit} />
    )
    const hexInput = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.focus(hexInput)
    fireEvent.change(hexInput, { target: { value: "#12" } })
    expect(hexInput.value).toBe("#12")
    expect(onHexCommit).not.toHaveBeenCalled()

    fireEvent.blur(hexInput)
    expect(hexInput.value).toBe("#ffffff")

    fireEvent.focus(hexInput)
    fireEvent.change(hexInput, { target: { value: "#123456" } })
    expect(onHexCommit).toHaveBeenCalledWith("#123456")

    const onSizeCommit = vi.fn()
    rerender(
      <BoundedNumberInput
        value={48}
        min={8}
        max={200}
        onCommit={onSizeCommit}
      />
    )
    const sizeInput = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.focus(sizeInput)
    fireEvent.change(sizeInput, { target: { value: "4" } })
    expect(sizeInput.value).toBe("4")
    expect(onSizeCommit).not.toHaveBeenCalled()

    fireEvent.blur(sizeInput)
    expect(sizeInput.value).toBe("48")

    fireEvent.focus(sizeInput)
    fireEvent.change(sizeInput, { target: { value: "72" } })
    expect(onSizeCommit).toHaveBeenCalledWith(72)
  })
})
