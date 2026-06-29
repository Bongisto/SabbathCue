// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ResultCard } from "./ResultCard"

afterEach(() => cleanup())

function setup(overrides: Partial<Parameters<typeof ResultCard>[0]> = {}) {
  const onPreview = vi.fn()
  const onLive = vi.fn()
  const onQueue = vi.fn()
  const onQueuedClick = vi.fn()
  render(
    <ResultCard
      reference="John 3:16"
      text="For God so loved the world."
      badgeLabel="KJV"
      onPreview={onPreview}
      onLive={onLive}
      onQueue={onQueue}
      onQueuedClick={onQueuedClick}
      {...overrides}
    />
  )
  return { onPreview, onLive, onQueue, onQueuedClick }
}

describe("ResultCard", () => {
  it("renders the reference, badge and text", () => {
    setup()
    expect(screen.getByText("John 3:16")).toBeTruthy()
    expect(screen.getByText("KJV")).toBeTruthy()
    expect(screen.getByText("For God so loved the world.")).toBeTruthy()
  })

  it("previews when the Preview action is clicked", () => {
    const { onPreview } = setup()
    fireEvent.click(screen.getByRole("button", { name: /preview/i }))
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it("sends live when the Send live action is clicked", () => {
    const { onLive } = setup()
    fireEvent.click(screen.getByRole("button", { name: /send live/i }))
    expect(onLive).toHaveBeenCalledTimes(1)
  })

  it("queues when not already queued", () => {
    const { onQueue } = setup({ queued: false })
    fireEvent.click(screen.getByRole("button", { name: /add to queue/i }))
    expect(onQueue).toHaveBeenCalledTimes(1)
  })

  it("flashes the existing item when already queued", () => {
    const { onQueuedClick, onQueue } = setup({ queued: true })
    fireEvent.click(screen.getByRole("button", { name: /already in queue/i }))
    expect(onQueuedClick).toHaveBeenCalledTimes(1)
    expect(onQueue).not.toHaveBeenCalled()
  })
})
