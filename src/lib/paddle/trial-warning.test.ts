import { describe, expect, it } from "vitest"
import type { BillingSummary } from "@/lib/supabase/billing"
import { TRIAL_WARNING_DAYS, deriveTrialWarning } from "./trial-warning"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-07-24T12:00:00.000Z")

function summary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    paddleCustomerId: "ctm_1",
    subscriptionId: "sub_1",
    subscriptionStatus: "trialing",
    scheduledChange: null,
    scheduledChangeAction: null,
    currentPeriodEnd: null,
    accessExpiresAt: new Date(NOW + 2 * DAY).toISOString(),
    ...overrides,
  }
}

describe("deriveTrialWarning", () => {
  it("warns a trialing account that its card is about to be charged", () => {
    const warning = deriveTrialWarning(summary(), NOW)
    expect(warning).toEqual({
      kind: "trial_converting",
      daysRemaining: 2,
      expiresAt: NOW + 2 * DAY,
    })
  })

  // The whole point of the function. access_expires_at is set for ALL access,
  // so a healthy subscriber's is just their next billing date. Keying on the
  // timestamp alone would tell every paying customer their trial was ending,
  // every single month.
  it("stays silent for a healthy auto-renewing subscriber", () => {
    expect(
      deriveTrialWarning(
        summary({ subscriptionStatus: "active", scheduledChangeAction: null }),
        NOW
      )
    ).toBeNull()
  })

  it("warns when a cancel is scheduled, whatever the status", () => {
    const warning = deriveTrialWarning(
      summary({
        subscriptionStatus: "active",
        scheduledChangeAction: "cancel",
        scheduledChange: new Date(NOW + DAY).toISOString(),
      }),
      NOW
    )
    expect(warning?.kind).toBe("cancel_scheduled")
  })

  it("warns on past_due regardless of how much time is left", () => {
    const warning = deriveTrialWarning(
      summary({
        subscriptionStatus: "past_due",
        accessExpiresAt: new Date(NOW + 30 * DAY).toISOString(),
      }),
      NOW
    )
    expect(warning?.kind).toBe("payment_failed")
    expect(warning?.daysRemaining).toBe(30)
  })

  it("warns a comped or EFT-granted account with no subscription", () => {
    const warning = deriveTrialWarning(
      summary({
        subscriptionId: null,
        subscriptionStatus: null,
        paddleCustomerId: null,
      }),
      NOW
    )
    expect(warning?.kind).toBe("access_ending")
  })

  it("prefers payment_failed over a scheduled cancel", () => {
    const warning = deriveTrialWarning(
      summary({
        subscriptionStatus: "past_due",
        scheduledChangeAction: "cancel",
      }),
      NOW
    )
    expect(warning?.kind).toBe("payment_failed")
  })

  describe("threshold", () => {
    it(`warns at exactly ${TRIAL_WARNING_DAYS} days`, () => {
      const warning = deriveTrialWarning(
        summary({
          accessExpiresAt: new Date(NOW + TRIAL_WARNING_DAYS * DAY).toISOString(),
        }),
        NOW
      )
      expect(warning?.daysRemaining).toBe(TRIAL_WARNING_DAYS)
    })

    it("stays silent just outside the window", () => {
      expect(
        deriveTrialWarning(
          summary({
            accessExpiresAt: new Date(
              NOW + TRIAL_WARNING_DAYS * DAY + 1
            ).toISOString(),
          }),
          NOW
        )
      ).toBeNull()
    })

    it("reports 0 days when under 24 hours remain", () => {
      const warning = deriveTrialWarning(
        summary({ accessExpiresAt: new Date(NOW + 60 * 1000).toISOString() }),
        NOW
      )
      expect(warning?.daysRemaining).toBe(0)
    })
  })

  describe("nothing to warn about", () => {
    it("returns null without a summary", () => {
      expect(deriveTrialWarning(null, NOW)).toBeNull()
    })

    it("returns null when no expiry is recorded", () => {
      expect(deriveTrialWarning(summary({ accessExpiresAt: null }), NOW)).toBeNull()
    })

    it("returns null on an unparseable expiry", () => {
      expect(
        deriveTrialWarning(summary({ accessExpiresAt: "not-a-date" }), NOW)
      ).toBeNull()
    })

    // Already locked out — register_device fails closed and the verification
    // gate is showing. A banner behind it would be pointless.
    it("returns null once access has already lapsed", () => {
      expect(
        deriveTrialWarning(
          summary({ accessExpiresAt: new Date(NOW - DAY).toISOString() }),
          NOW
        )
      ).toBeNull()
    })

    it("returns null for paused and canceled without a live expiry", () => {
      expect(
        deriveTrialWarning(
          summary({
            subscriptionStatus: "canceled",
            accessExpiresAt: new Date(NOW - 1).toISOString(),
          }),
          NOW
        )
      ).toBeNull()
    })
  })
})
