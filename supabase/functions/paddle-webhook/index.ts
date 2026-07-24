import {
  Environment,
  EventName,
  Paddle,
  type CustomerCreatedEvent,
  type CustomerUpdatedEvent,
  type EventEntity,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
} from "npm:@paddle/paddle-node-sdk@2.8.0"
import { createClient } from "npm:@supabase/supabase-js@2.49.1"
import { isPaddleWebhookRequestIpAllowed } from "../_shared/paddle-webhook-ip.ts"

type SubscriptionEvent =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionCanceledEvent

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

function getServiceSupabase() {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) throw new Error("Supabase service credentials are not configured")
  return createClient(url, key, { auth: { persistSession: false } })
}

function parsePeriodEnd(sub: SubscriptionEvent["data"]): string | null {
  const endsAt = sub.currentBillingPeriod?.endsAt
  return typeof endsAt === "string" ? endsAt : null
}

function parseScheduledChange(sub: SubscriptionEvent["data"]): string | null {
  const effectiveAt = sub.scheduledChange?.effectiveAt
  return typeof effectiveAt === "string" ? effectiveAt : null
}

function parseScheduledChangeAction(
  sub: SubscriptionEvent["data"]
): string | null {
  const action = sub.scheduledChange?.action
  return typeof action === "string" ? action : null
}

function parseSupabaseUserId(customData: unknown): string | null {
  if (!customData || typeof customData !== "object") return null
  const value = (customData as Record<string, unknown>).supabase_user_id
  if (typeof value !== "string") return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null
}

async function upsertCustomer(
  supabase: ReturnType<typeof getServiceSupabase>,
  event: CustomerCreatedEvent | CustomerUpdatedEvent
) {
  const email = event.data.email?.trim()
  if (!email) throw new Error("Paddle customer event is missing an email")
  const { error } = await supabase.rpc("paddle_process_customer_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_event_occurred_at: event.occurredAt,
    p_customer_id: event.data.id,
    p_email: email,
  })
  if (error) throw error
}

async function upsertSubscription(
  supabase: ReturnType<typeof getServiceSupabase>,
  event: SubscriptionEvent
) {
  const sub = event.data
  let email = sub.customer?.email?.trim()
  if (!email) {
    const { data: existingCustomer } = await supabase
      .from("paddle_customers")
      .select("email")
      .eq("customer_id", sub.customerId)
      .maybeSingle()
    email = existingCustomer?.email?.trim()
  }
  if (!email) throw new Error("Paddle subscription event is missing a customer email")

  const { error } = await supabase.rpc("paddle_process_subscription_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_event_occurred_at: event.occurredAt,
    p_subscription_id: sub.id,
    p_customer_id: sub.customerId,
    p_email: email,
    p_user_id: parseSupabaseUserId(sub.customData),
    p_status: sub.status,
    p_price_id: sub.items[0]?.price?.id ?? "",
    p_product_id: sub.items[0]?.price?.productId ?? "",
    p_period_end: parsePeriodEnd(sub),
    p_scheduled_change: parseScheduledChange(sub),
    p_scheduled_change_action: parseScheduledChangeAction(sub),
  })
  if (error) throw error
}

async function upsertTransactionCompleted(
  supabase: ReturnType<typeof getServiceSupabase>,
  event: TransactionCompletedEvent
) {
  const txn = event.data
  const customerId = txn.customerId
  if (!customerId) {
    // Incomplete customer on the transaction — nothing to mirror for access.
    return
  }

  let email: string | undefined
  if (txn.customer && typeof txn.customer === "object") {
    const nested = (txn.customer as { email?: unknown }).email
    if (typeof nested === "string" && nested.trim()) email = nested.trim()
  }

  if (!email) {
    const { data: existingCustomer } = await supabase
      .from("paddle_customers")
      .select("email")
      .eq("customer_id", customerId)
      .maybeSingle()
    email = existingCustomer?.email?.trim()
  }

  if (!email) {
    throw new Error("Paddle transaction.completed is missing a customer email")
  }

  const { error } = await supabase.rpc("paddle_process_transaction_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_event_occurred_at: event.occurredAt,
    p_customer_id: customerId,
    p_email: email,
    p_user_id: parseSupabaseUserId(txn.customData),
  })
  if (error) throw error
}

async function processEvent(
  supabase: ReturnType<typeof getServiceSupabase>,
  event: EventEntity
) {
  switch (event.eventType) {
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      return upsertCustomer(supabase, event)
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
      return upsertSubscription(supabase, event)
    case EventName.TransactionCompleted:
      return upsertTransactionCompleted(supabase, event)
    default:
      // Safely ignore other event types we are not subscribed to handle.
      return
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    const ipCheck = await isPaddleWebhookRequestIpAllowed(request)
    if (!ipCheck.allowed) {
      console.error(
        "paddle-webhook: rejected request from non-Paddle IP",
        ipCheck.ip ?? "unknown"
      )
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const signature = request.headers.get("paddle-signature") ?? ""
    // RAW body required — never JSON.parse before unmarshal.
    const rawBody = await request.text()
    let secret: string
    try {
      secret = requireEnv("PADDLE_NOTIFICATION_WEBHOOK_SECRET")
    } catch {
      console.error("paddle-webhook: missing PADDLE_NOTIFICATION_WEBHOOK_SECRET")
      return Response.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    if (!signature || !rawBody) {
      return Response.json({ error: "Missing signature or body" }, { status: 400 })
    }

    try {
      const paddle = getPaddle()
      const event = await paddle.webhooks.unmarshal(rawBody, secret, signature)
      if (!event) {
        return Response.json({ received: true })
      }

      const supabase = getServiceSupabase()
      await processEvent(supabase, event)

      return Response.json({ received: true })
    } catch (error) {
      // Non-2xx so Paddle retries. Includes signature verification failures.
      console.error("paddle-webhook error:", error)
      return Response.json({ error: "Internal error" }, { status: 500 })
    }
  },
}
