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

  it("calls onCancelled after a successful cancel", async () => {
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: true,
      result: {
        status: "active",
        scheduledChange: "2026-09-01T00:00:00Z",
      },
    })

    const onCancelled = vi.fn()
    const { CancelSubscriptionButton } = await import(
      "@/components/billing/CancelSubscriptionButton"
    )
    render(<CancelSubscriptionButton onCancelled={onCancelled} />)

    fireEvent.click(screen.getByRole("button", { name: /cancel subscription/i }))
    fireEvent.click(
      screen.getByRole("button", { name: /confirm cancel renewal/i })
    )

    await vi.waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1)
    })
  })
})
