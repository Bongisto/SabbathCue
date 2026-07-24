// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockActivateSubscriptionNow = vi.fn()

vi.mock("@/lib/supabase/billing", () => ({
  activateSubscriptionNow: (...args: unknown[]) =>
    mockActivateSubscriptionNow(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

describe("ActivateSubscriptionButton", () => {
  beforeEach(() => {
    mockActivateSubscriptionNow.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("requires confirmation before activating", async () => {
    mockActivateSubscriptionNow.mockResolvedValue({
      ok: true,
      result: {
        status: "active",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
      },
    })

    const { ActivateSubscriptionButton } = await import(
      "@/components/billing/ActivateSubscriptionButton"
    )
    render(<ActivateSubscriptionButton />)

    fireEvent.click(
      screen.getByRole("button", { name: /start paid subscription now/i })
    )
    expect(mockActivateSubscriptionNow).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /confirm and pay now/i }))

    expect(mockActivateSubscriptionNow).toHaveBeenCalledTimes(1)
  })

  it("calls onActivated after a successful activation", async () => {
    mockActivateSubscriptionNow.mockResolvedValue({
      ok: true,
      result: {
        status: "active",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
      },
    })

    const onActivated = vi.fn()
    const { ActivateSubscriptionButton } = await import(
      "@/components/billing/ActivateSubscriptionButton"
    )
    render(<ActivateSubscriptionButton onActivated={onActivated} />)

    fireEvent.click(
      screen.getByRole("button", { name: /start paid subscription now/i })
    )
    fireEvent.click(screen.getByRole("button", { name: /confirm and pay now/i }))

    await vi.waitFor(() => {
      expect(onActivated).toHaveBeenCalledTimes(1)
    })
  })
})
