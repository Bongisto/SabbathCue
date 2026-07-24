// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockCancelSubscriptionAtPeriodEnd = vi.fn()

vi.mock("@/lib/supabase/billing", () => ({
  cancelSubscriptionAtPeriodEnd: (...args: unknown[]) =>
    mockCancelSubscriptionAtPeriodEnd(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

describe("CancelSubscriptionButton", () => {
  beforeEach(() => {
    mockCancelSubscriptionAtPeriodEnd.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("requires confirmation before calling cancel", async () => {
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: true,
      result: {
        status: "active",
        scheduledChange: "2026-09-01T00:00:00Z",
      },
    })

    const { CancelSubscriptionButton } = await import(
      "@/components/billing/CancelSubscriptionButton"
    )
    render(<CancelSubscriptionButton />)

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }))
    expect(mockCancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel renewal/i })
    )

    expect(mockCancelSubscriptionAtPeriodEnd).toHaveBeenCalledTimes(1)
  })

  it("calls onBillingStateChanged after a successful cancel", async () => {
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: true,
      result: {
        status: "active",
        scheduledChange: "2026-09-01T00:00:00Z",
      },
    })

    const onBillingStateChanged = vi.fn()
    const { CancelSubscriptionButton } = await import(
      "@/components/billing/CancelSubscriptionButton"
    )
    render(<CancelSubscriptionButton onBillingStateChanged={onBillingStateChanged} />)

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel renewal/i })
    )

    await vi.waitFor(() => {
      expect(onBillingStateChanged).toHaveBeenCalledTimes(1)
    })
  })

  it("calls onBillingStateChanged when the server says it is already scheduled to cancel", async () => {
    // The button only renders when the parent's billing summary says the
    // subscription is not scheduled to cancel, so this response proves that
    // summary is stale. onBillingStateChanged refetches it; without that call the parent
    // keeps showing a cancel button the server will reject.
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: false,
      message: "Subscription already scheduled to cancel",
    })

    const onBillingStateChanged = vi.fn()
    const { CancelSubscriptionButton } = await import(
      "@/components/billing/CancelSubscriptionButton"
    )
    render(<CancelSubscriptionButton onBillingStateChanged={onBillingStateChanged} />)

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel renewal/i })
    )

    await vi.waitFor(() => {
      expect(onBillingStateChanged).toHaveBeenCalledTimes(1)
    })
  })

  it("does not call onBillingStateChanged on a genuine failure", async () => {
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: false,
      message: "No cancellable subscription",
    })

    const onBillingStateChanged = vi.fn()
    const { CancelSubscriptionButton } = await import(
      "@/components/billing/CancelSubscriptionButton"
    )
    render(<CancelSubscriptionButton onBillingStateChanged={onBillingStateChanged} />)

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel renewal/i })
    )

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel subscription/i })).toBeTruthy()
    })
    expect(onBillingStateChanged).not.toHaveBeenCalled()
  })
})
