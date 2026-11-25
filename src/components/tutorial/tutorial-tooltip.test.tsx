// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TooltipRenderProps } from "react-joyride"
import { TutorialTooltip } from "./tutorial-tooltip"

describe("TutorialTooltip", () => {
  afterEach(() => {
    cleanup()
  })

  it("uses the root-level opaque shell background outside the app shell", () => {
    render(
      <TutorialTooltip
        {...({
          index: 0,
          step: { content: "Learn this lesson", title: "Lesson" },
          size: 1,
          isLastStep: true,
          backProps: {},
          primaryProps: {},
          skipProps: {},
          controls: { next: vi.fn(), prev: vi.fn(), skip: vi.fn() },
          tooltipProps: {},
        } as unknown as TooltipRenderProps)}
      />,
    )

    expect(screen.getByText("Lesson").parentElement?.parentElement?.getAttribute("style")).toContain(
      "var(--shell-bg-deep)",
    )
  })

  it("calls controls.next() on ArrowRight even on the last step (FU-36)", () => {
    const next = vi.fn()
    const prev = vi.fn()
    const skip = vi.fn()
    render(
      <TutorialTooltip
        {...({
          index: 2,
          step: { content: "Final step", title: "Done" },
          size: 3,
          isLastStep: true,
          backProps: {},
          primaryProps: {},
          skipProps: {},
          controls: { next, prev, skip },
          tooltipProps: {},
        } as unknown as TooltipRenderProps)}
      />,
    )

    fireEvent.keyDown(document, { key: "ArrowRight" })

    expect(next).toHaveBeenCalledTimes(1)
    expect(skip).not.toHaveBeenCalled()
  })
})
