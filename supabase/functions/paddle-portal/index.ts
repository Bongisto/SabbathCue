import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk@2.8.0"
import { withSupabase } from "npm:@supabase/server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
}

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

const authenticated = withSupabase({ auth: "user" }, async (_request, context) => {
  // 1. Authenticate first — never mint a portal for an anonymous caller.
  const claims = context.userClaims as Record<string, unknown> | undefined
  const userId = typeof claims?.sub === "string" ? claims.sub : ""
  const email = typeof claims?.email === "string" ? claims.email.trim() : ""
  if (!userId || !email) {
    return json({ error: "Not authenticated" }, 401)
  }

  // 2. Resolve Paddle customer ID server-side from the session user.
  //    Never accept a customer_id from the client body.
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

  const { data: subRows, error: subError } = await context.supabaseAdmin
    .from("paddle_subscriptions")
    .select("subscription_id")
    .eq("customer_id", customerRow.customer_id)

  if (subError) {
    return json({ error: subError.message }, 500)
  }

  const subscriptionIds = (subRows ?? []).map((row) => row.subscription_id)

  try {
    const paddle = getPaddle()
    const session = await paddle.customerPortalSessions.create(
      customerRow.customer_id,
      subscriptionIds
    )
    return json({ url: session.urls.general.overview })
  } catch (error) {
    console.error("paddle-portal error:", error)
    return json({ error: "Could not create portal session" }, 500)
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
