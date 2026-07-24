/**
 * Pure helpers for Paddle subscription access gating.
 * Keep in sync with paddle_recalculate_user_access in
 * supabase/migrations/010_paddle_billing.sql (and 011 for scheduled_change_action).
 */

export type PaddleSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "paused"
  | "canceled"
  | string

/**
 * Whether this Paddle subscription status currently grants paid product access.
 *
 * - active / trialing: yes
 * - past_due: NO. There is deliberately no dunning grace period.
 * - paused / canceled: no
 * - A scheduled cancel/pause does NOT revoke access while status remains active
 *
 * past_due granted access until 2026-07-24. That grace never actually worked:
 * access_expires_at is max(current_period_end), and a failed charge does not
 * advance current_period_end, so the timestamp gate in register_device closed
 * regardless of what this returned. Rather than build a real grace window, the
 * owner chose to withhold grace, so this now states the enforced behaviour.
 */
export function subscriptionStatusGrantsAccess(
  status: PaddleSubscriptionStatus | null | undefined
): boolean {
  if (!status) return false
  return status === "active" || status === "trialing"
}
