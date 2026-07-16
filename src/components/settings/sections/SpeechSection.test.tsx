// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProviderSelector } from "./SpeechSection"

describe("ProviderSelector", () => {
  afterEach(cleanup)

  it("highlights Soniox as the best provider", () => {
    render(
      <ProviderSelector
        sttProvider="deepgram"
        switchingStt={false}
        onProviderChange={vi.fn()}
      />
    )

    const sonioxOption = screen.getByText(/Cloud \(Soniox/).closest("label")
    expect(sonioxOption).not.toBeNull()
    expect(within(sonioxOption!).getByText("Best")).not.toBeNull()
    expect(sonioxOption?.getAttribute("data-recommended")).toBe("true")
    expect(sonioxOption?.className).toContain("border-primary/60")
    expect(sonioxOption?.className).not.toContain(
      "hover:border-muted-foreground/25"
    )

    const deepgramOption = screen.getByText(/Cloud \(Deepgram/).closest("label")
    expect(within(deepgramOption!).queryByText("Best")).toBeNull()
  })
})
