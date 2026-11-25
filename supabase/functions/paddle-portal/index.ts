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

const authenticated = withSupabase({ auth: "user" }, async (_request, context) => {
  // 1. Authenticate first — never mint a portal for an anonymous caller.
  const claims = context.userClaims as Record<string, unknown> | undefined
  const userId = typeof claims?.sub === "string" ? claims.sub : ""
  const email = typeof claims?.email === "string" ? claims.email.trim() : ""
  if (!userId || !email) {
    return json({ error: "Not authenticated" }, 401)
  }

  // 2. Resolve Paddle customer IDs server-side from the session user.
  //    Never accept a customer_id from the client body.
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
    .select("customer_id, subscription_id, subscription_status")
    .in("customer_id", customerIds)
    .order("updated_at", { ascending: false })

  if (subError) {
    return json({ error: subError.message }, 500)
  }

  const allSubs = subRows ?? []
  const statusRank = (status: string | null | undefined): number => {
    if (status === "active" || status === "trialing") return 2
    if (status === "past_due") return 1
    return 0
  }

  let targetCustomerId = customerIds[0]
  if (allSubs.length > 0) {
    const bestSub = [...allSubs].sort((a, b) => {
      const rankDiff =
        statusRank(b.subscription_status) - statusRank(a.subscription_status)
      if (rankDiff !== 0) return rankDiff
      return (ownedIds.has(b.customer_id) ? 1 : 0) - (ownedIds.has(a.customer_id) ? 1 : 0)
    })[0]
    targetCustomerId = bestSub.customer_id
  }

  const subscriptionIds = allSubs
    .filter((row) => row.customer_id === targetCustomerId)
    .map((row) => row.subscription_id)

  try {
    const paddle = getPaddle()
    const session = await paddle.customerPortalSessions.create(
      targetCustomerId,
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
