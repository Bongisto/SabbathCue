// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockOpenSubscriptionCheckout = vi.fn()
const mockIsYearlyCheckoutAvailable = vi.fn()

vi.mock("@/lib/paddle/checkout", () => ({
  onCheckoutCompleted: () => () => {},
  openSubscriptionCheckout: (...args: unknown[]) =>
    mockOpenSubscriptionCheckout(...args),
}))

vi.mock("@/lib/paddle/client", () => ({
  getPaddleInstance: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/paddle/config", () => ({
  isPaddleCheckoutConfigured: () => true,
  isYearlyCheckoutAvailable: () => mockIsYearlyCheckoutAvailable(),
}))

vi.mock("@/lib/supabase/billing", () => ({
  ensureFreshAuthSession: vi.fn().mockResolvedValue(true),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

describe("PaddleSubscribePanel", () => {
  beforeEach(() => {
    mockOpenSubscriptionCheckout.mockReset()
    mockIsYearlyCheckoutAvailable.mockReturnValue(true)
    mockOpenSubscriptionCheckout.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
  })

  it("opens monthly checkout by default", async () => {
    const { PaddleSubscribePanel } = await import(
      "@/components/billing/PaddleSubscribePanel"
    )
    render(
      <PaddleSubscribePanel email="buyer@example.com" userId="user-1" />
    )

    await waitFor(() => {
      const button = screen.getByRole("button", {
        name: /subscribe or renew/i,
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole("button", { name: /subscribe or renew/i }))

    await waitFor(() => {
      expect(mockOpenSubscriptionCheckout).toHaveBeenCalledWith({
        email: "buyer@example.com",
        userId: "user-1",
        interval: "month",
      })
    })
  })

  it("opens yearly checkout when yearly is selected", async () => {
    const { PaddleSubscribePanel } = await import(
      "@/components/billing/PaddleSubscribePanel"
    )
    render(
      <PaddleSubscribePanel email="buyer@example.com" userId="user-1" />
    )

    await waitFor(() => {
      const button = screen.getByRole("button", {
        name: /subscribe or renew/i,
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })

    fireEvent.click(screen.getByRole("button", { name: /^yearly$/i }))
    fireEvent.click(screen.getByRole("button", { name: /subscribe or renew/i }))

    await waitFor(() => {
      expect(mockOpenSubscriptionCheckout).toHaveBeenCalledWith({
        email: "buyer@example.com",
        userId: "user-1",
        interval: "year",
      })
    })
  })
})
