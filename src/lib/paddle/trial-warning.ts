/**
 * Derives the "access is about to end" warning shown by TrialWarningBanner.
 *
 * Pure on purpose — no React, no network — so every status/deadline
 * combination is testable. Keep in sync with subscriptionStatusGrantsAccess
 * in ./access.ts and with paddle_recalculate_user_access in
 * supabase/migrations/012_no_past_due_grace.sql.
 */

import type { BillingSummary } from "@/lib/supabase/billing"

const DAY_MS = 24 * 60 * 60 * 1000

/** Warn once access ends within this many days. */
export const TRIAL_WARNING_DAYS = 3

export type TrialWarningKind =
  | "payment_failed"
  | "cancel_scheduled"
  | "trial_converting"
  | "access_ending"

export interface TrialWarning {
  kind: TrialWarningKind
  /** Whole days until access ends. 0 means less than 24 hours. */
  daysRemaining: number
  /** Epoch ms when access ends. */
  expiresAt: number
}

function parseExpiry(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Returns the warning to show, or null to stay silent.
 *
 * Silent for a healthy auto-renewing subscription. That case carries the
 * design: account_flags.access_expires_at is set for ALL access, so a paying
 * customer's expiry is simply their next billing date. Keying on the timestamp
 * alone would announce an ending trial to every subscriber every month.
 *
 * Also silent once access has already lapsed — register_device fails closed and
 * the verification gate is already covering the app, so a banner behind it
 * would be noise.
 */
export function deriveTrialWarning(
  summary: BillingSummary | null,
  now: number
): TrialWarning | null {
  if (!summary) return null

  const expiresAt = parseExpiry(summary.accessExpiresAt)
  if (expiresAt === null) return null

  const msRemaining = expiresAt - now
  if (msRemaining <= 0) return null

  const daysRemaining = Math.max(0, Math.floor(msRemaining / DAY_MS))
  const withinWindow = msRemaining <= TRIAL_WARNING_DAYS * DAY_MS
  const base = { daysRemaining, expiresAt }

  // A failed charge is urgent whenever it is discovered, so it ignores the
  // window. There is no dunning grace, so the deadline is real.
  if (summary.subscriptionStatus === "past_due") {
    return { kind: "payment_failed", ...base }
  }

  if (!withinWindow) return null

  if (summary.scheduledChangeAction === "cancel") {
    return { kind: "cancel_scheduled", ...base }
  }

  if (summary.subscriptionStatus === "trialing") {
    return { kind: "trial_converting", ...base }
  }

  // No subscription but access is set: an admin comp, pilot extension, or an
  // EFT payment granted via admin_set_access. Nothing will renew it.
  if (!summary.subscriptionId) {
    return { kind: "access_ending", ...base }
  }

  return null
}
