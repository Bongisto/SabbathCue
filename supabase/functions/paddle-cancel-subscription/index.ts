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

  let { data: customerRow, error: customerError } = await context.supabaseAdmin
    .from("paddle_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!customerRow && !customerError) {
    const fallback = await context.supabaseAdmin
      .from("paddle_customers")
      .select("customer_id")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    customerRow = fallback.data
    customerError = fallback.error
  }

  if (customerError) {
    return json({ error: customerError.message }, 500)
  }
  if (!customerRow?.customer_id) {
    return json({ error: "No Paddle customer" }, 404)
  }

  const { data: subRow, error: subError } = await context.supabaseAdmin
    .from("paddle_subscriptions")
    .select(
      "subscription_id, subscription_status, scheduled_change, scheduled_change_action"
    )
    .eq("customer_id", customerRow.customer_id)
    .in("subscription_status", CANCELLABLE_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subError) {
    return json({ error: subError.message }, 500)
  }
  if (!subRow?.subscription_id) {
    return json({ error: "No cancellable subscription" }, 404)
  }
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
