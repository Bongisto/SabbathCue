import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk@2.8.0"
import { withSupabase } from "npm:@supabase/server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
}

const CANCELLABLE_STATUSES = ["active", "trialing", "past_due"]

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders })
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function getPaddleEnvironment(): Environment {
  const raw = requireEnv("PADDLE_ENV")
  if (raw === "production") return Environment.production
  if (raw === "sandbox") return Environment.sandbox
  throw new Error(
    `Invalid PADDLE_ENV="${raw}". Expected "sandbox" or "production".`
  )
}

function getPaddle(): Paddle {
  return new Paddle(requireEnv("PADDLE_API_KEY"), {
    environment: getPaddleEnvironment(),
  })
}

function formatScheduledChange(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value.trim()) return value
  return null
}

const authenticated = withSupabase({ auth: "user" }, async (_request, context) => {
  const claims = context.userClaims as Record<string, unknown> | undefined
  const userId = typeof claims?.sub === "string" ? claims.sub : ""
  const email = typeof claims?.email === "string" ? claims.email.trim() : ""
  if (!userId || !email) {
    return json({ error: "Not authenticated" }, 401)
  }

  const { data: ownedRows, error: ownedError } = await context.supabaseAdmin
    .from("paddle_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (ownedError) {
    return json({ error: ownedError.message }, 500)
  }

  const { data: unlinkedRows, error: unlinkedError } = await context.supabaseAdmin
    .from("paddle_customers")
    .select("customer_id, email")
    .is("user_id", null)
    .ilike("email", escapeIlikePattern(email))
    .order("updated_at", { ascending: false })

  if (unlinkedError) {
    return json({ error: unlinkedError.message }, 500)
  }

  const normalizedEmail = email.toLowerCase()
  const ownedIds = new Set<string>()
  const seenCustomerIds = new Set<string>()
  const customerIds: string[] = []

  for (const row of ownedRows ?? []) {
    if (typeof row.customer_id === "string" && !seenCustomerIds.has(row.customer_id)) {
      seenCustomerIds.add(row.customer_id)
      ownedIds.add(row.customer_id)
      customerIds.push(row.customer_id)
    }
  }

  for (const row of unlinkedRows ?? []) {
    if (
      typeof row.customer_id === "string" &&
      typeof row.email === "string" &&
      row.email.trim().toLowerCase() === normalizedEmail &&
      !seenCustomerIds.has(row.customer_id)
    ) {
      seenCustomerIds.add(row.customer_id)
      customerIds.push(row.customer_id)
    }
  }

  if (customerIds.length === 0) {
    return json({ error: "No Paddle customer" }, 404)
  }

  const { data: subRows, error: subError } = await context.supabaseAdmin
    .from("paddle_subscriptions")
    .select(
      "customer_id, subscription_id, subscription_status, scheduled_change, scheduled_change_action"
    )
    .in("customer_id", customerIds)
    .in("subscription_status", CANCELLABLE_STATUSES)
    .order("updated_at", { ascending: false })

  if (subError) {
    return json({ error: subError.message }, 500)
  }
  if (!subRows || subRows.length === 0) {
    return json({ error: "No cancellable subscription" }, 404)
  }

  const isCancelScheduled = (row: (typeof subRows)[number]): boolean =>
    Boolean(row.scheduled_change && row.scheduled_change_action === "cancel")
  const statusRank = (status: string | null | undefined): number => {
    if (status === "active" || status === "trialing") return 1
    return 0
  }

  const subRow = [...subRows].sort((a, b) => {
    const schedDiff = Number(isCancelScheduled(a)) - Number(isCancelScheduled(b))
    if (schedDiff !== 0) return schedDiff
    const statusDiff =
      statusRank(b.subscription_status) - statusRank(a.subscription_status)
    if (statusDiff !== 0) return statusDiff
    return (ownedIds.has(b.customer_id) ? 1 : 0) - (ownedIds.has(a.customer_id) ? 1 : 0)
  })[0]

  if (subRow.scheduled_change && subRow.scheduled_change_action === "cancel") {
    return json({ error: "Subscription already scheduled to cancel" }, 409)
  }

  try {
    const paddle = getPaddle()
    const subscription = await paddle.subscriptions.cancel(
      subRow.subscription_id,
      { effectiveFrom: "next_billing_period" }
    )

    return json({
      success: true,
      status: subscription.status,
      scheduledChange: formatScheduledChange(
        subscription.scheduledChange?.effectiveAt
      ),
    })
  } catch (error) {
    console.error("paddle-cancel-subscription error:", error)
    return json({ error: "Could not cancel subscription" }, 500)
  }
})

export default {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405)
    }
    return authenticated(request)
  },
}
