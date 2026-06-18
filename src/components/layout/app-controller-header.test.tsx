// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAccentThemeStore } from "@/stores/accent-theme-store"
import { useColorModeStore } from "@/stores/color-mode-store"
import { AppControllerHeader } from "./app-controller-header"

vi.mock("@/lib/operator-actions", () => ({
  blackoutOutput: vi.fn(),
}))

function renderHeader() {
  return render(
    <TooltipProvider>
      <AppControllerHeader />
    </TooltipProvider>,
  )
}

describe("AppControllerHeader color mode controls", () => {
  beforeEach(() => {
    document.documentElement.className = ""
    localStorage.clear()
    useAccentThemeStore.setState({ theme: "teal" })
    useColorModeStore.getState().setMode("dark")
  })

  afterEach(() => {
    cleanup()
  })

  it("toggles the controller shell between dark and light mode", () => {
    renderHeader()

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(document.documentElement.classList.contains("light")).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeTruthy()
  })

  it("shows accent swatches only in dark mode", () => {
    renderHeader()

    expect(screen.getByText("Theme:")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Soft Teal" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }))

    expect(screen.queryByText("Theme:")).toBeNull()
    expect(screen.queryByRole("button", { name: "Soft Teal" })).toBeNull()
  })
})
