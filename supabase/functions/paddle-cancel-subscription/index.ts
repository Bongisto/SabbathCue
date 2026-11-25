import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk@2.8.0"
import { withSupabase } from "npm:@supabase/server"

const ALLOWED_CORS_ORIGINS = new Set([
  "https://sabbath-cue-two.vercel.app",
  "https://bongisto.github.io",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
])
const LOCAL_DEV_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/
const CORS_ALLOW_HEADERS = "authorization, apikey, content-type, x-client-info"
const CORS_ALLOW_METHODS = "POST, OPTIONS"

function extraAllowedOrigins(): string[] {
  const raw =
    typeof Deno !== "undefined" ? (Deno.env.get("ALLOWED_CORS_ORIGINS") ?? "") : ""
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*")
}

function isAllowedCorsOrigin(origin: string): boolean {
  return (
    ALLOWED_CORS_ORIGINS.has(origin) ||
    LOCAL_DEV_ORIGIN_RE.test(origin) ||
    extraAllowedOrigins().includes(origin)
  )
}

function corsHeadersForRequest(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    Vary: "Origin",
  }
  const origin = request.headers.get("origin")?.trim()
  if (origin && isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  return headers
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  headers.delete("Access-Control-Allow-Origin")
  for (const [key, value] of Object.entries(corsHeadersForRequest(request))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function preflightResponse(request: Request): Response {
  const headers = corsHeadersForRequest(request)
  if (
    request.headers.get("origin") !== null &&
    !headers["Access-Control-Allow-Origin"]
  ) {
    return new Response("Forbidden", { status: 403, headers })
  }
  return new Response("ok", { headers })
}

const CANCELLABLE_STATUSES = ["active", "trialing", "past_due"]

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
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
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return preflightResponse(request)
    }
    if (request.method !== "POST") {
      return withCors(request, json({ error: "Method not allowed" }, 405))
    }
    return withCors(request, await authenticated(request))
  },
}
