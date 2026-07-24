import { callRpc } from "@/lib/supabase/rpc"
import { getSupabaseClient } from "@/lib/supabase/client"
import { restoreSession } from "@/lib/supabase/auth"
import {
  getRefreshToken,
  setRefreshToken,
} from "@/lib/verification/session-storage"

export interface BillingSummary {
  paddleCustomerId: string | null
  subscriptionId: string | null
  subscriptionStatus: string | null
  scheduledChange: string | null
  scheduledChangeAction: string | null
  currentPeriodEnd: string | null
  accessExpiresAt: string | null
}

const BILLING_CATCH = "Unable to reach the billing service."

const CANCELLABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
])

export interface CancelSubscriptionResult {
  status: string
  scheduledChange: string | null
}

export interface ActivateSubscriptionResult {
  status: string
  currentPeriodEnd: string | null
}

function parseBillingSummary(value: unknown): BillingSummary | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const nullableString = (candidate: unknown): string | null =>
    typeof candidate === "string" ? candidate : null

  return {
    paddleCustomerId: nullableString(row.paddle_customer_id),
    subscriptionId: nullableString(row.subscription_id),
    subscriptionStatus: nullableString(row.subscription_status),
    scheduledChange: nullableString(row.scheduled_change),
    scheduledChangeAction: nullableString(row.scheduled_change_action),
    currentPeriodEnd: nullableString(row.current_period_end),
    accessExpiresAt: nullableString(row.access_expires_at),
  }
}

export async function fetchMyBillingSummary(): Promise<
  { ok: true; summary: BillingSummary } | { ok: false; message: string }
> {
  const authed = await ensureFreshAuthSession()
  if (!authed) {
    return { ok: false, message: "Sign in again to view billing." }
  }

  const result = await callRpc<unknown>("get_my_billing_summary", {
    errorFallback: "Could not load billing details.",
    catchFallback: BILLING_CATCH,
  })
  if (!result.ok) return { ok: false, message: result.message }
  const summary = parseBillingSummary(result.data)
  if (!summary) {
    return { ok: false, message: "Unexpected billing response." }
  }
  return { ok: true, summary }
}

/**
 * supabase-js reports every non-2xx edge reply as the same
 * "Edge Function returned a non-2xx status code" message and hides the real
 * body on `error.context`. Read the body so callers see the actual reason.
 */
async function readEdgeFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context
  if (!(context instanceof Response)) return null
  try {
    const body: unknown = await context.clone().json()
    const message = (body as { error?: unknown } | null)?.error
    return typeof message === "string" && message.trim() ? message.trim() : null
  } catch {
    return null
  }
}

async function refreshAuthedSession(): Promise<
  { ok: true; accessToken: string } | { ok: false; message: string }
> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    return { ok: false, message: "Sign in again to manage billing." }
  }

  const supabase = getSupabaseClient()
  const { data: sessionData, error: sessionError } =
    await supabase.auth.refreshSession({ refresh_token: refreshToken })
  const session = sessionData?.session
  const accessToken = session?.access_token
  if (sessionError || !accessToken) {
    return { ok: false, message: "Sign in again to manage billing." }
  }

  if (session?.refresh_token) {
    await setRefreshToken(session.refresh_token)
  }

  return { ok: true, accessToken }
}

export async function createCustomerPortalSession(): Promise<
  { ok: true; url: string } | { ok: false; message: string }
> {
  try {
    const session = await refreshAuthedSession()
    if (!session.ok) return session

    const { data, error } = await getSupabaseClient().functions.invoke(
      "paddle-portal",
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    )

    if (error) {
      const message =
        (await readEdgeFunctionError(error)) || error.message || BILLING_CATCH
      if (message.toLowerCase().includes("no paddle customer")) {
        return { ok: false, message: "No Paddle customer" }
      }
      return { ok: false, message }
    }

    const payload = data as { url?: unknown; error?: unknown } | null
    if (typeof payload?.error === "string") {
      return { ok: false, message: payload.error }
    }

    const url = payload?.url
    if (typeof url !== "string" || !url.startsWith("https://")) {
      return { ok: false, message: "Billing portal URL was not returned." }
    }

    return { ok: true, url }
  } catch {
    return { ok: false, message: BILLING_CATCH }
  }
}

export function isSubscriptionCancelScheduled(
  summary: BillingSummary | null
): boolean {
  return Boolean(
    summary?.scheduledChange && summary.scheduledChangeAction === "cancel"
  )
}

/** True when the user can cancel renewal at the end of the current period. */
export function canCancelSubscription(summary: BillingSummary | null): boolean {
  if (!summary?.subscriptionId || !summary.subscriptionStatus) return false
  if (!CANCELLABLE_SUBSCRIPTION_STATUSES.has(summary.subscriptionStatus)) {
    return false
  }
  return !isSubscriptionCancelScheduled(summary)
}

/** True when the user can end a Paddle trial early and start billing now. */
export function canActivateSubscriptionEarly(
  summary: BillingSummary | null
): boolean {
  if (!summary?.subscriptionId) return false
  if (summary.subscriptionStatus !== "trialing") return false
  return !isSubscriptionCancelScheduled(summary)
}

export async function cancelSubscriptionAtPeriodEnd(): Promise<
  { ok: true; result: CancelSubscriptionResult } | { ok: false; message: string }
> {
  try {
    const session = await refreshAuthedSession()
    if (!session.ok) return session

    const { data, error } = await getSupabaseClient().functions.invoke(
      "paddle-cancel-subscription",
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    )

    if (error) {
      const message =
        (await readEdgeFunctionError(error)) || error.message || BILLING_CATCH
      return { ok: false, message }
    }

    const payload = data as {
      success?: unknown
      status?: unknown
      scheduledChange?: unknown
      error?: unknown
    } | null

    if (typeof payload?.error === "string") {
      return { ok: false, message: payload.error }
    }

    if (payload?.success !== true || typeof payload.status !== "string") {
      return { ok: false, message: "Unexpected cancellation response." }
    }

    const scheduledChange =
      typeof payload.scheduledChange === "string" ? payload.scheduledChange : null

    return {
      ok: true,
      result: {
        status: payload.status,
        scheduledChange,
      },
    }
  } catch {
    return { ok: false, message: BILLING_CATCH }
  }
}

export async function activateSubscriptionNow(): Promise<
  | { ok: true; result: ActivateSubscriptionResult }
  | { ok: false; message: string }
> {
  try {
    const session = await refreshAuthedSession()
    if (!session.ok) return session

    const { data, error } = await getSupabaseClient().functions.invoke(
      "paddle-activate-subscription",
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    )

    if (error) {
      const message =
        (await readEdgeFunctionError(error)) || error.message || BILLING_CATCH
      return { ok: false, message }
    }

    const payload = data as {
      success?: unknown
      status?: unknown
      currentPeriodEnd?: unknown
      error?: unknown
    } | null

    if (typeof payload?.error === "string") {
      return { ok: false, message: payload.error }
    }

    if (payload?.success !== true || typeof payload.status !== "string") {
      return { ok: false, message: "Unexpected activation response." }
    }

    const currentPeriodEnd =
      typeof payload.currentPeriodEnd === "string"
        ? payload.currentPeriodEnd
        : null

    return {
      ok: true,
      result: {
        status: payload.status,
        currentPeriodEnd,
      },
    }
  } catch {
    return { ok: false, message: BILLING_CATCH }
  }
}

/** Refresh auth before checkout when the access token may be stale. */
export async function ensureFreshAuthSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false
  const restored = await restoreSession()
  return restored.ok
}

export function formatSubscriptionStatusLabel(
  summary: BillingSummary | null
): string | null {
  if (!summary?.subscriptionStatus) return null
  if (summary.scheduledChange) {
    const when = new Date(summary.scheduledChange)
    const label = Number.isNaN(when.getTime())
      ? "soon"
      : when.toLocaleDateString()
    const action = summary.scheduledChangeAction
    if (action === "pause") return `Pauses on ${label}`
    return `Cancels on ${label}`
  }
  switch (summary.subscriptionStatus) {
    case "active":
      return "Active subscription"
    case "trialing":
      return "Trial subscription"
    case "past_due":
      return "Payment past due"
    case "canceled":
      return "Subscription ended"
    case "paused":
      return "Subscription paused"
    default:
      return summary.subscriptionStatus
  }
}
