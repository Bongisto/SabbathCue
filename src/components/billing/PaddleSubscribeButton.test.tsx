// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockOpenSubscriptionCheckout = vi.fn()
const mockOnCheckoutCompleted = vi.fn()
const mockGetPaddleInstance = vi.fn()
const mockEnsureFreshAuthSession = vi.fn()

vi.mock("@/lib/paddle/checkout", () => ({
  onCheckoutCompleted: (...args: unknown[]) => mockOnCheckoutCompleted(...args),
  openSubscriptionCheckout: (...args: unknown[]) =>
    mockOpenSubscriptionCheckout(...args),
}))

vi.mock("@/lib/paddle/client", () => ({
  getPaddleInstance: (...args: unknown[]) => mockGetPaddleInstance(...args),
}))

vi.mock("@/lib/paddle/config", () => ({
  isPaddleCheckoutConfigured: () => true,
}))

vi.mock("@/lib/supabase/billing", () => ({
  ensureFreshAuthSession: (...args: unknown[]) =>
    mockEnsureFreshAuthSession(...args),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

describe("PaddleSubscribeButton", () => {
  beforeEach(() => {
    mockOpenSubscriptionCheckout.mockReset()
    mockOnCheckoutCompleted.mockReset()
    mockGetPaddleInstance.mockReset()
    mockEnsureFreshAuthSession.mockReset()

    mockGetPaddleInstance.mockResolvedValue({ id: "paddle-sdk" })
    mockOnCheckoutCompleted.mockReturnValue(() => {})
    mockEnsureFreshAuthSession.mockResolvedValue(true)
    mockOpenSubscriptionCheckout.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
  })

  it("initializes Paddle once, subscribes to completion, and resets loading when ensureFreshAuthSession throws", async () => {
    mockEnsureFreshAuthSession.mockRejectedValue(new Error("keychain failed"))
    const onCompleted = vi.fn()

    const { PaddleSubscribeButton } = await import(
      "@/components/billing/PaddleSubscribeButton"
    )
    render(
      <PaddleSubscribeButton
        email="buyer@example.com"
        userId="user-1"
        onCompleted={onCompleted}
      />
    )

    await waitFor(() => {
      const button = screen.getByRole("button", {
        name: /subscribe to renew/i,
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })

    expect(mockGetPaddleInstance).toHaveBeenCalledTimes(1)
    expect(mockOnCheckoutCompleted).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: /subscribe to renew/i }))

    await waitFor(() => {
      expect(mockOpenSubscriptionCheckout).toHaveBeenCalledWith({
        email: "buyer@example.com",
        userId: "user-1",
      })
      const button = screen.getByRole("button", {
        name: /subscribe to renew/i,
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
    })
  })
})
