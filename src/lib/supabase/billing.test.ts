import { FunctionsHttpError } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSupabaseClientForTests } from "@/lib/supabase/client"

const mockRefreshSession = vi.fn()
const mockInvoke = vi.fn()
const mockRpc = vi.fn()

vi.mock("@/lib/supabase/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/client")>()
  return {
    ...actual,
    getSupabaseClient: () => ({
      auth: { refreshSession: mockRefreshSession },
      functions: { invoke: mockInvoke },
      rpc: mockRpc,
    }),
  }
})

const mockGetRefreshToken = vi.fn()
const mockSetRefreshToken = vi.fn()

vi.mock("@/lib/verification/session-storage", () => ({
  getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
  setRefreshToken: (...args: unknown[]) => mockSetRefreshToken(...args),
  clearToken: vi.fn(),
}))

const mockRestoreSession = vi.fn()

vi.mock("@/lib/supabase/auth", () => ({
  restoreSession: (...args: unknown[]) => mockRestoreSession(...args),
}))

/** Mirrors what supabase-js hands back for a non-2xx edge function reply. */
function httpError(status: number, body: unknown): FunctionsHttpError {
  return new FunctionsHttpError(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )
}

describe("createCustomerPortalSession", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRefreshSession.mockReset()
    mockInvoke.mockReset()
    mockRpc.mockReset()
    mockGetRefreshToken.mockReset()
    mockSetRefreshToken.mockReset()
    mockRestoreSession.mockReset()

    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
          refresh_token: "rotated-token",
        },
      },
      error: null,
    })
    mockInvoke.mockResolvedValue({
      data: { url: "https://portal.paddle.com/session" },
      error: null,
    })
  })

  it("persists the rotated refresh token so the next launch can restore", async () => {
    const { createCustomerPortalSession } = await import("@/lib/supabase/billing")
    const result = await createCustomerPortalSession()

    expect(result).toEqual({ ok: true, url: "https://portal.paddle.com/session" })
    expect(mockSetRefreshToken).toHaveBeenCalledWith("rotated-token")
  })

  it("reads the no-customer case from the 404 body, not the generic message", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(404, { error: "No Paddle customer" }),
    })

    const { createCustomerPortalSession } = await import("@/lib/supabase/billing")

    await expect(createCustomerPortalSession()).resolves.toEqual({
      ok: false,
      message: "No Paddle customer",
    })
  })

  it("surfaces the edge function error body instead of the supabase wrapper text", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(500, { error: "Paddle API key is not configured" }),
    })

    const { createCustomerPortalSession } = await import("@/lib/supabase/billing")
    const result = await createCustomerPortalSession()

    expect(result).toEqual({
      ok: false,
      message: "Paddle API key is not configured",
    })
  })

  it("rejects a portal url that is not https", async () => {
    mockInvoke.mockResolvedValue({
      data: { url: "javascript:alert(1)" },
      error: null,
    })

    const { createCustomerPortalSession } = await import("@/lib/supabase/billing")
    const result = await createCustomerPortalSession()

    expect(result).toEqual({
      ok: false,
      message: "Billing portal URL was not returned.",
    })
  })

  it("asks the user to sign in again when no refresh token is stored", async () => {
    mockGetRefreshToken.mockResolvedValue(null)

    const { createCustomerPortalSession } = await import("@/lib/supabase/billing")
    const result = await createCustomerPortalSession()

    expect(result).toEqual({
      ok: false,
      message: "Sign in again to manage billing.",
    })
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})

describe("cancelSubscriptionAtPeriodEnd", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRefreshSession.mockReset()
    mockInvoke.mockReset()
    mockGetRefreshToken.mockReset()
    mockSetRefreshToken.mockReset()

    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
          refresh_token: "rotated-token",
        },
      },
      error: null,
    })
  })

  it("returns the scheduled cancellation date from the edge function", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        status: "active",
        scheduledChange: "2026-09-01T00:00:00Z",
      },
      error: null,
    })

    const { cancelSubscriptionAtPeriodEnd } = await import("@/lib/supabase/billing")
    const result = await cancelSubscriptionAtPeriodEnd()

    expect(result).toEqual({
      ok: true,
      result: {
        status: "active",
        scheduledChange: "2026-09-01T00:00:00Z",
      },
    })
    expect(mockInvoke).toHaveBeenCalledWith("paddle-cancel-subscription", {
      headers: { Authorization: "Bearer access-token" },
    })
    expect(mockSetRefreshToken).toHaveBeenCalledWith("rotated-token")
  })

  it("surfaces already-scheduled cancellations from the 409 body", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(409, {
        error: "Subscription already scheduled to cancel",
      }),
    })

    const { cancelSubscriptionAtPeriodEnd } = await import("@/lib/supabase/billing")
    const result = await cancelSubscriptionAtPeriodEnd()

    expect(result).toEqual({
      ok: false,
      message: "Subscription already scheduled to cancel",
    })
  })

  it("asks the user to sign in again when no refresh token is stored", async () => {
    mockGetRefreshToken.mockResolvedValue(null)

    const { cancelSubscriptionAtPeriodEnd } = await import("@/lib/supabase/billing")
    const result = await cancelSubscriptionAtPeriodEnd()

    expect(result).toEqual({
      ok: false,
      message: "Sign in again to manage billing.",
    })
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})

describe("canCancelSubscription", () => {
  const base = {
    paddleCustomerId: "ctm_1",
    subscriptionId: "sub_1",
    subscriptionStatus: "active",
    scheduledChange: null,
    scheduledChangeAction: null,
    currentPeriodEnd: "2026-08-01T00:00:00Z",
    accessExpiresAt: "2026-08-01T00:00:00Z",
  }

  it("allows cancel for active, trialing, and past_due subscriptions", async () => {
    const { canCancelSubscription } = await import("@/lib/supabase/billing")
    expect(canCancelSubscription(base)).toBe(true)
    expect(
      canCancelSubscription({ ...base, subscriptionStatus: "trialing" })
    ).toBe(true)
    expect(
      canCancelSubscription({ ...base, subscriptionStatus: "past_due" })
    ).toBe(true)
  })

  it("blocks cancel when renewal is already scheduled", async () => {
    const { canCancelSubscription, isSubscriptionCancelScheduled } = await import(
      "@/lib/supabase/billing"
    )
    const scheduled = {
      ...base,
      scheduledChange: "2026-09-01T00:00:00Z",
      scheduledChangeAction: "cancel",
    }
    expect(isSubscriptionCancelScheduled(scheduled)).toBe(true)
    expect(canCancelSubscription(scheduled)).toBe(false)
  })

  it("blocks cancel without an eligible subscription", async () => {
    const { canCancelSubscription } = await import("@/lib/supabase/billing")
    expect(canCancelSubscription(null)).toBe(false)
    expect(
      canCancelSubscription({ ...base, subscriptionStatus: "canceled" })
    ).toBe(false)
    expect(canCancelSubscription({ ...base, subscriptionId: null })).toBe(false)
  })
})

describe("activateSubscriptionNow", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRefreshSession.mockReset()
    mockInvoke.mockReset()
    mockGetRefreshToken.mockReset()
    mockSetRefreshToken.mockReset()

    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
          refresh_token: "rotated-token",
        },
      },
      error: null,
    })
  })

  it("returns active status and period end from the edge function", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        status: "active",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
      },
      error: null,
    })

    const { activateSubscriptionNow } = await import("@/lib/supabase/billing")
    const result = await activateSubscriptionNow()

    expect(result).toEqual({
      ok: true,
      result: {
        status: "active",
        currentPeriodEnd: "2026-09-01T00:00:00Z",
      },
    })
    expect(mockInvoke).toHaveBeenCalledWith("paddle-activate-subscription", {
      headers: { Authorization: "Bearer access-token" },
    })
  })

  it("surfaces scheduled-cancel conflicts from the 409 body", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: httpError(409, {
        error: "Cannot activate a subscription scheduled to cancel",
      }),
    })

    const { activateSubscriptionNow } = await import("@/lib/supabase/billing")
    const result = await activateSubscriptionNow()

    expect(result).toEqual({
      ok: false,
      message: "Cannot activate a subscription scheduled to cancel",
    })
  })
})

describe("canActivateSubscriptionEarly", () => {
  const base = {
    paddleCustomerId: "ctm_1",
    subscriptionId: "sub_1",
    subscriptionStatus: "trialing",
    scheduledChange: null,
    scheduledChangeAction: null,
    currentPeriodEnd: "2026-08-01T00:00:00Z",
    accessExpiresAt: "2026-08-01T00:00:00Z",
  }

  it("allows activation only for trialing subscriptions", async () => {
    const { canActivateSubscriptionEarly } = await import("@/lib/supabase/billing")
    expect(canActivateSubscriptionEarly(base)).toBe(true)
    expect(
      canActivateSubscriptionEarly({ ...base, subscriptionStatus: "active" })
    ).toBe(false)
    expect(canActivateSubscriptionEarly(null)).toBe(false)
  })

  it("blocks activation when cancel is already scheduled", async () => {
    const { canActivateSubscriptionEarly } = await import("@/lib/supabase/billing")
    expect(
      canActivateSubscriptionEarly({
        ...base,
        scheduledChange: "2026-09-01T00:00:00Z",
        scheduledChangeAction: "cancel",
      })
    ).toBe(false)
  })
})

describe("fetchMyBillingSummary", () => {
  beforeEach(() => {
    resetSupabaseClientForTests()
    mockRpc.mockReset()
    mockGetRefreshToken.mockReset()
    mockRestoreSession.mockReset()

    mockGetRefreshToken.mockResolvedValue("stored-token")
    mockRestoreSession.mockResolvedValue({ ok: true })
  })

  it("maps the snake_case RPC payload onto the billing summary", async () => {
    mockRpc.mockResolvedValue({
      data: {
        paddle_customer_id: "ctm_1",
        subscription_id: "sub_1",
        subscription_status: "active",
        scheduled_change: null,
        current_period_end: "2026-08-01T00:00:00Z",
        access_expires_at: "2026-08-01T00:00:00Z",
      },
      error: null,
    })

    const { fetchMyBillingSummary } = await import("@/lib/supabase/billing")
    const result = await fetchMyBillingSummary()

    expect(result).toEqual({
      ok: true,
      summary: {
        paddleCustomerId: "ctm_1",
        subscriptionId: "sub_1",
        subscriptionStatus: "active",
        scheduledChange: null,
        scheduledChangeAction: null,
        currentPeriodEnd: "2026-08-01T00:00:00Z",
        accessExpiresAt: "2026-08-01T00:00:00Z",
      },
    })
  })

  it("does not call the RPC when the session cannot be refreshed", async () => {
    mockRestoreSession.mockResolvedValue({ ok: false })

    const { fetchMyBillingSummary } = await import("@/lib/supabase/billing")
    const result = await fetchMyBillingSummary()

    expect(result).toEqual({
      ok: false,
      message: "Sign in again to view billing.",
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe("formatSubscriptionStatusLabel", () => {
  const base = {
    paddleCustomerId: "ctm_1",
    subscriptionId: "sub_1",
    subscriptionStatus: "active",
    scheduledChange: null,
    scheduledChangeAction: null,
    currentPeriodEnd: null,
    accessExpiresAt: null,
  }

  it("returns null without a subscription", async () => {
    const { formatSubscriptionStatusLabel } = await import(
      "@/lib/supabase/billing"
    )
    expect(formatSubscriptionStatusLabel(null)).toBeNull()
    expect(
      formatSubscriptionStatusLabel({ ...base, subscriptionStatus: null })
    ).toBeNull()
  })

  it("prefers the scheduled cancellation over the raw status", async () => {
    const { formatSubscriptionStatusLabel } = await import(
      "@/lib/supabase/billing"
    )
    const label = formatSubscriptionStatusLabel({
      ...base,
      scheduledChange: "2026-09-01T00:00:00Z",
    })
    expect(label).toMatch(/^Cancels on /)
  })

  it("falls back to 'soon' when the scheduled change is unparseable", async () => {
    const { formatSubscriptionStatusLabel } = await import(
      "@/lib/supabase/billing"
    )
    expect(
      formatSubscriptionStatusLabel({ ...base, scheduledChange: "not-a-date" })
    ).toBe("Cancels on soon")
  })

  it("maps known Paddle statuses to human labels", async () => {
    const { formatSubscriptionStatusLabel } = await import(
      "@/lib/supabase/billing"
    )
    expect(formatSubscriptionStatusLabel(base)).toBe("Active subscription")
    expect(
      formatSubscriptionStatusLabel({ ...base, subscriptionStatus: "past_due" })
    ).toBe("Payment past due")
    expect(
      formatSubscriptionStatusLabel({ ...base, subscriptionStatus: "weird" })
    ).toBe("weird")
  })
})
