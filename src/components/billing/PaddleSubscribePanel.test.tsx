// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockOpenSubscriptionCheckout = vi.fn()
const mockIsYearlyCheckoutAvailable = vi.fn()
const mockGetPaddleInstance = vi.fn()
const mockSetPaddleCustomerIdForInit = vi.fn()
const mockEnsureFreshAuthSession = vi.fn()
const mockFetchMyBillingSummary = vi.fn()

vi.mock("@/lib/paddle/checkout", () => ({
  onCheckoutCompleted: () => () => {},
  openSubscriptionCheckout: (...args: unknown[]) =>
    mockOpenSubscriptionCheckout(...args),
}))

vi.mock("@/lib/paddle/client", () => ({
  getPaddleInstance: (...args: unknown[]) => mockGetPaddleInstance(...args),
  setPaddleCustomerIdForInit: (...args: unknown[]) =>
    mockSetPaddleCustomerIdForInit(...args),
}))

vi.mock("@/lib/paddle/config", () => ({
  isPaddleCheckoutConfigured: () => true,
  isYearlyCheckoutAvailable: () => mockIsYearlyCheckoutAvailable(),
}))

// The panel's mount effect awaits fetchMyBillingSummary before it flips to
// ready, so omitting it here leaves the subscribe button permanently disabled.
vi.mock("@/lib/supabase/billing", () => ({
  ensureFreshAuthSession: (...args: unknown[]) =>
    mockEnsureFreshAuthSession(...args),
  fetchMyBillingSummary: (...args: unknown[]) =>
    mockFetchMyBillingSummary(...args),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

describe("PaddleSubscribePanel", () => {
  beforeEach(() => {
    mockOpenSubscriptionCheckout.mockReset()
    mockGetPaddleInstance.mockReset()
    mockSetPaddleCustomerIdForInit.mockReset()
    mockEnsureFreshAuthSession.mockReset()
    mockFetchMyBillingSummary.mockReset()
    mockIsYearlyCheckoutAvailable.mockReturnValue(true)
    mockOpenSubscriptionCheckout.mockResolvedValue({ ok: true })
    mockGetPaddleInstance.mockResolvedValue({})
    mockEnsureFreshAuthSession.mockResolvedValue(true)
    mockFetchMyBillingSummary.mockResolvedValue({
      ok: true,
      summary: { paddleCustomerId: null },
    })
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

  it("sets paddleCustomerId before initializing Paddle once on mount", async () => {
    const callOrder: string[] = []
    mockFetchMyBillingSummary.mockResolvedValue({
      ok: true,
      summary: { paddleCustomerId: "ctm_123" },
    })
    mockSetPaddleCustomerIdForInit.mockImplementation(() => {
      callOrder.push("setCustomerId")
    })
    mockGetPaddleInstance.mockImplementation(async () => {
      callOrder.push("getPaddleInstance")
      return {}
    })

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

    expect(mockSetPaddleCustomerIdForInit).toHaveBeenCalledWith("ctm_123")
    expect(mockGetPaddleInstance).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(["setCustomerId", "getPaddleInstance"])
  })

  it("resets loading state when ensureFreshAuthSession throws", async () => {
    mockEnsureFreshAuthSession.mockRejectedValue(new Error("keychain failed"))

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
      expect(mockOpenSubscriptionCheckout).toHaveBeenCalledTimes(1)
      const button = screen.getByRole("button", {
        name: /subscribe or renew/i,
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })
  })
})
