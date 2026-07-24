import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Paddle } from "@paddle/paddle-js"

const mockGetPaddleCatalogConfig = vi.fn()

vi.mock("@/lib/paddle/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paddle/config")>()
  return {
    ...actual,
    getPaddleCatalogConfig: () => mockGetPaddleCatalogConfig(),
    isPaddleCheckoutConfigured: () => mockGetPaddleCatalogConfig() !== null,
  }
})

const mockGetPaddleInstance = vi.fn()

vi.mock("@/lib/paddle/client", () => ({
  getPaddleInstance: () => mockGetPaddleInstance(),
}))

/**
 * Minimal stand-in for the Paddle SDK: `Update` overwrites the single
 * eventCallback slot exactly like the real one does.
 */
function createFakePaddle() {
  const state: { eventCallback?: (event: { name?: string }) => void } = {}
  const updateCalls: unknown[] = []
  const paddle = {
    Update(options: { eventCallback?: (event: { name?: string }) => void }) {
      updateCalls.push(options)
      state.eventCallback = options.eventCallback
    },
    Checkout: { open: vi.fn() },
  }
  return {
    paddle: paddle as unknown as Paddle,
    updateCalls,
    emit(name: string) {
      state.eventCallback?.({ name })
    },
  }
}

describe("onCheckoutCompleted", () => {
  beforeEach(async () => {
    const { resetCheckoutSubscribersForTests } = await import(
      "@/lib/paddle/checkout"
    )
    resetCheckoutSubscribersForTests()
  })

  it("notifies every subscriber instead of the most recent one", async () => {
    const { onCheckoutCompleted } = await import("@/lib/paddle/checkout")
    const fake = createFakePaddle()
    const first = vi.fn()
    const second = vi.fn()

    onCheckoutCompleted(fake.paddle, first)
    onCheckoutCompleted(fake.paddle, second)
    fake.emit("checkout.completed")

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("keeps the remaining subscribers alive after one unsubscribes", async () => {
    const { onCheckoutCompleted } = await import("@/lib/paddle/checkout")
    const fake = createFakePaddle()
    const staying = vi.fn()
    const leaving = vi.fn()

    onCheckoutCompleted(fake.paddle, staying)
    const unsubscribe = onCheckoutCompleted(fake.paddle, leaving)
    unsubscribe()
    fake.emit("checkout.completed")

    expect(leaving).not.toHaveBeenCalled()
    expect(staying).toHaveBeenCalledTimes(1)
  })

  it("ignores checkout events other than completion", async () => {
    const { onCheckoutCompleted } = await import("@/lib/paddle/checkout")
    const fake = createFakePaddle()
    const handler = vi.fn()

    onCheckoutCompleted(fake.paddle, handler)
    fake.emit("checkout.loaded")
    fake.emit("checkout.closed")

    expect(handler).not.toHaveBeenCalled()
  })

  it("installs the Paddle event callback only once", async () => {
    const { onCheckoutCompleted } = await import("@/lib/paddle/checkout")
    const fake = createFakePaddle()

    onCheckoutCompleted(fake.paddle, vi.fn())
    onCheckoutCompleted(fake.paddle, vi.fn())
    onCheckoutCompleted(fake.paddle, vi.fn())

    expect(fake.updateCalls).toHaveLength(1)
  })
})

describe("openSubscriptionCheckout", () => {
  beforeEach(() => {
    mockGetPaddleCatalogConfig.mockReset()
    mockGetPaddleInstance.mockReset()
    mockGetPaddleCatalogConfig.mockReturnValue({
      clientToken: "test_token",
      environment: "sandbox",
      priceId: { month: "pri_123", year: "pri_year" },
    })
  })

  it("opens checkout with the price, trimmed email, and supabase user id", async () => {
    const fake = createFakePaddle()
    mockGetPaddleInstance.mockResolvedValue(fake.paddle)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")
    const result = await openSubscriptionCheckout({
      email: "  buyer@example.com  ",
      userId: "11111111-1111-4111-8111-111111111111",
    })

    expect(result).toEqual({ ok: true })
    expect(fake.paddle.Checkout.open).toHaveBeenCalledWith({
      items: [{ priceId: "pri_123", quantity: 1 }],
      customer: { email: "buyer@example.com" },
      customData: { supabase_user_id: "11111111-1111-4111-8111-111111111111" },
    })
  })

  it("opens yearly checkout when interval is year", async () => {
    const fake = createFakePaddle()
    mockGetPaddleInstance.mockResolvedValue(fake.paddle)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")
    const result = await openSubscriptionCheckout({
      email: "buyer@example.com",
      userId: "11111111-1111-4111-8111-111111111111",
      interval: "year",
    })

    expect(result).toEqual({ ok: true })
    expect(fake.paddle.Checkout.open).toHaveBeenCalledWith({
      items: [{ priceId: "pri_year", quantity: 1 }],
      customer: { email: "buyer@example.com" },
      customData: { supabase_user_id: "11111111-1111-4111-8111-111111111111" },
    })
  })

  it("reports when yearly checkout is not configured", async () => {
    mockGetPaddleCatalogConfig.mockReturnValue({
      clientToken: "test_token",
      environment: "sandbox",
      priceId: { month: "pri_123", year: null },
    })
    const fake = createFakePaddle()
    mockGetPaddleInstance.mockResolvedValue(fake.paddle)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")
    const result = await openSubscriptionCheckout({
      email: "buyer@example.com",
      userId: "11111111-1111-4111-8111-111111111111",
      interval: "year",
    })

    expect(result).toEqual({
      ok: false,
      message: "Yearly checkout is not configured in this build.",
    })
    expect(fake.paddle.Checkout.open).not.toHaveBeenCalled()
  })

  it("explains when the build has no Paddle catalog configured", async () => {
    mockGetPaddleCatalogConfig.mockReturnValue(null)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")
    const result = await openSubscriptionCheckout({
      email: "buyer@example.com",
      userId: "11111111-1111-4111-8111-111111111111",
    })

    expect(result.ok).toBe(false)
    expect(mockGetPaddleInstance).not.toHaveBeenCalled()
  })

  it("reports a failure when the Paddle SDK cannot load", async () => {
    mockGetPaddleInstance.mockResolvedValue(undefined)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")

    await expect(
      openSubscriptionCheckout({
        email: "buyer@example.com",
        userId: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toEqual({
      ok: false,
      message: "Could not load the checkout service.",
    })
  })

  it("reports a failure when Paddle throws opening the overlay", async () => {
    const fake = createFakePaddle()
    ;(fake.paddle.Checkout.open as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        throw new Error("bad price")
      }
    )
    mockGetPaddleInstance.mockResolvedValue(fake.paddle)

    const { openSubscriptionCheckout } = await import("@/lib/paddle/checkout")

    await expect(
      openSubscriptionCheckout({
        email: "buyer@example.com",
        userId: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toEqual({ ok: false, message: "Could not open checkout." })
  })
})
