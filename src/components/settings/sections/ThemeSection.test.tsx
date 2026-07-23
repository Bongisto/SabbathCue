// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeSection } from "./ThemeSection"
import { useColorModeStore } from "@/stores/color-mode-store"

const mockSetWorkspace = vi.hoisted(() => vi.fn())
const mockSetDesignerOpen = vi.hoisted(() => vi.fn())

vi.mock("@/stores/dashboard-workspace-store", () => ({
  useDashboardWorkspaceStore: {
    getState: () => ({ setWorkspace: mockSetWorkspace }),
  },
}))

vi.mock("@/stores/broadcast/designer-store", () => ({
  useBroadcastDesignerStore: {
    getState: () => ({ setDesignerOpen: mockSetDesignerOpen }),
  },
}))

vi.mock("@/components/broadcast/theme-designer", () => ({
  ThemeDesigner: () => <div data-testid="theme-designer" />,
}))

describe("ThemeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useColorModeStore.setState({ darkSurface: "charcoal" })
  })

  afterEach(() => cleanup())

  it("opens the dedicated themes workspace", () => {
    render(<ThemeSection />)

    fireEvent.click(screen.getByRole("button", { name: /Open themes/ }))

    expect(mockSetWorkspace).toHaveBeenCalledWith("kinetic-themes")
  })

  it("still opens the full theme designer", () => {
    render(<ThemeSection />)

    fireEvent.click(screen.getByRole("button", { name: /Open theme designer/ }))

    expect(mockSetDesignerOpen).toHaveBeenCalledWith(true)
  })

  it("keeps charcoal and warm obsidian mutually exclusive", () => {
    render(<ThemeSection />)

    fireEvent.click(screen.getByRole("switch", { name: "Warm obsidian dark mode" }))

    expect(useColorModeStore.getState().darkSurface).toBe("warm")
    expect(
      screen
        .getByRole("switch", { name: "Warm obsidian dark mode" })
        .getAttribute("aria-checked")
    ).toBe("true")
    expect(
      screen
        .getByRole("switch", { name: "Charcoal dark mode" })
        .getAttribute("aria-checked")
    ).toBe("false")
  })
})
