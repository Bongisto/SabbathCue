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
 * - past_due: yes (grace while Paddle retries payment)
 * - paused / canceled: no
 * - A scheduled cancel/pause does NOT revoke access while status remains active
 */
export function subscriptionStatusGrantsAccess(
  status: PaddleSubscriptionStatus | null | undefined
): boolean {
  if (!status) return false
  return status === "active" || status === "trialing" || status === "past_due"
}
