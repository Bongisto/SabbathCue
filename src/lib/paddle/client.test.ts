import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Paddle } from "@paddle/paddle-js"

const mockInitializePaddle = vi.fn()
const mockGetPaddleCatalogConfig = vi.fn()

vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: (...args: unknown[]) => mockInitializePaddle(...args),
}))

vi.mock("@/lib/paddle/config", () => ({
  getPaddleCatalogConfig: () => mockGetPaddleCatalogConfig(),
}))

describe("paddle client", () => {
  beforeEach(async () => {
    mockInitializePaddle.mockReset()
    mockGetPaddleCatalogConfig.mockReset()
    mockGetPaddleCatalogConfig.mockReturnValue({
      clientToken: "test_token",
      environment: "sandbox",
      priceId: { month: "pri_month", year: "pri_year" },
    })
    const { resetPaddleInstanceForTests } = await import("@/lib/paddle/client")
    resetPaddleInstanceForTests()
  })

  it("does not invalidate cached instance when customerId is unchanged", async () => {
    const fakePaddle = { Checkout: { open: vi.fn() } } as unknown as Paddle
    mockInitializePaddle.mockResolvedValue(fakePaddle)

    const {
      getPaddleInstance,
      onPaddleInstanceInvalidated,
      setPaddleCustomerIdForInit,
    } = await import("@/lib/paddle/client")
    const onInvalidated = vi.fn()
    const unsubscribe = onPaddleInstanceInvalidated(onInvalidated)

    setPaddleCustomerIdForInit("ctm_123")
    expect(onInvalidated).toHaveBeenCalledTimes(1)

    await getPaddleInstance()
    setPaddleCustomerIdForInit("  ctm_123  ")
    await getPaddleInstance()

    expect(mockInitializePaddle).toHaveBeenCalledTimes(1)
    expect(onInvalidated).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("invalidates cached instance and notifies listeners when customerId changes", async () => {
    const firstPaddle = { id: 1 } as unknown as Paddle
    const secondPaddle = { id: 2 } as unknown as Paddle
    mockInitializePaddle
      .mockResolvedValueOnce(firstPaddle)
      .mockResolvedValueOnce(secondPaddle)

    const {
      getPaddleInstance,
      onPaddleInstanceInvalidated,
      setPaddleCustomerIdForInit,
    } = await import("@/lib/paddle/client")
    const onInvalidated = vi.fn()
    const unsubscribe = onPaddleInstanceInvalidated(onInvalidated)

    await expect(getPaddleInstance()).resolves.toBe(firstPaddle)
    setPaddleCustomerIdForInit("ctm_456")
    expect(onInvalidated).toHaveBeenCalledTimes(1)

    await expect(getPaddleInstance()).resolves.toBe(secondPaddle)
    expect(mockInitializePaddle).toHaveBeenCalledTimes(2)
    expect(mockInitializePaddle).toHaveBeenLastCalledWith(
      expect.objectContaining({ pwCustomer: { id: "ctm_456" } })
    )
    unsubscribe()
  })

  it("clears cached promise on initialization failure so subsequent calls retry", async () => {
    const recoveredPaddle = { id: "recovered" } as unknown as Paddle
    mockInitializePaddle
      .mockRejectedValueOnce(new Error("script failed"))
      .mockResolvedValueOnce(recoveredPaddle)

    const { getPaddleInstance } = await import("@/lib/paddle/client")

    await expect(getPaddleInstance()).rejects.toThrow("script failed")
    await expect(getPaddleInstance()).resolves.toBe(recoveredPaddle)
    expect(mockInitializePaddle).toHaveBeenCalledTimes(2)
  })
})
