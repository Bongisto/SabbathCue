import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("../../../supabase/migrations/010_paddle_billing.sql", import.meta.url),
  "utf8"
)
const migration011 = readFileSync(
  new URL(
    "../../../supabase/migrations/011_paddle_transaction_and_scheduled_action.sql",
    import.meta.url
  ),
  "utf8"
)
const webhook = readFileSync(
  new URL("../../../supabase/functions/paddle-webhook/index.ts", import.meta.url),
  "utf8"
)
const cancelSubscription = readFileSync(
  new URL(
    "../../../supabase/functions/paddle-cancel-subscription/index.ts",
    import.meta.url
  ),
  "utf8"
)
const activateSubscription = readFileSync(
  new URL(
    "../../../supabase/functions/paddle-activate-subscription/index.ts",
    import.meta.url
  ),
  "utf8"
)

describe("Paddle billing database contract", () => {
  it("grants the webhook service role access to internal RPCs", () => {
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.paddle_link_customer_user\(text,\s*uuid\)\s+TO service_role;/s
    )
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.paddle_process_subscription_event\([\s\S]*?\)\s+TO service_role;/
    )
  })

  it("returns a nullable billing summary without an unassigned record", () => {
    expect(migration).not.toContain("v_sub record;")
    expect(migration).toContain("v_subscription_id text;")
    expect(migration).toContain("'subscription_id', v_subscription_id")
  })

  it("stores event ordering and processing state", () => {
    expect(migration).toContain("occurred_at timestamptz NOT NULL")
    expect(migration).toContain("processed_at timestamptz")
    expect(migration).toContain("last_event_occurred_at timestamptz NOT NULL")
    expect(migration).toContain("processed_at IS NULL")
  })

  it("processes subscription state atomically in the database", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.paddle_process_subscription_event"
    )
    expect(migration).toMatch(
      /INSERT INTO public\.paddle_webhook_events[\s\S]*INSERT INTO public\.paddle_subscriptions[\s\S]*processed_at = now\(\)/
    )
    expect(webhook).toContain('.rpc("paddle_process_subscription_event"')
    expect(webhook).not.toContain("recordEventIfNew")
  })

  it("passes Paddle event time and checkout user identity to the atomic RPC", () => {
    expect(webhook).toContain("p_event_occurred_at: event.occurredAt")
    expect(webhook).toContain("p_user_id: parseSupabaseUserId(sub.customData)")
    expect(migration).not.toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS paddle_customers_email_lower_idx"
    )
  })

  it("recalculates access from every eligible subscription", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.paddle_recalculate_user_access"
    )
    expect(migration).toMatch(
      /subscription_status IN \('active', 'trialing', 'past_due'\)/
    )
    expect(migration).toContain("max(current_period_end)")
  })

  it("handles transaction.completed via an idempotent RPC", () => {
    expect(migration011).toContain(
      "CREATE OR REPLACE FUNCTION public.paddle_process_transaction_event"
    )
    expect(webhook).toContain("EventName.TransactionCompleted")
    expect(webhook).toContain('.rpc("paddle_process_transaction_event"')
  })

  it("stores scheduled_change_action and passes it from the webhook", () => {
    expect(migration011).toContain("scheduled_change_action text")
    expect(webhook).toContain("p_scheduled_change_action:")
  })

  it("verifies the raw body with the notification signing secret", () => {
    expect(webhook).toContain("await request.text()")
    expect(webhook).toContain(
      "paddle.webhooks.unmarshal(rawBody, secret, signature)"
    )
    expect(webhook).toContain("PADDLE_NOTIFICATION_WEBHOOK_SECRET")
    expect(webhook).not.toContain("JSON.parse(rawBody)")
  })

  it("fails loudly when PADDLE_ENV is unset instead of defaulting", () => {
    expect(webhook).toContain('requireEnv("PADDLE_ENV")')
    expect(webhook).not.toMatch(/PADDLE_ENV.*\?\?.*"sandbox"/)
  })
})

describe("Paddle cancel subscription edge function contract", () => {
  it("authenticates before resolving the Paddle customer", () => {
    expect(cancelSubscription).toContain('return json({ error: "Not authenticated" }, 401)')
    expect(cancelSubscription).toContain('.eq("user_id", userId)')
  })

  it("never accepts a subscription id from the client body", () => {
    expect(cancelSubscription).not.toContain("request.json")
    expect(cancelSubscription).toContain('.in("subscription_status", CANCELLABLE_STATUSES)')
  })

  it("schedules cancellation for the next billing period only", () => {
    expect(cancelSubscription).toContain("paddle.subscriptions.cancel")
    expect(cancelSubscription).toContain('effectiveFrom: "next_billing_period"')
    expect(cancelSubscription).not.toContain("immediately")
  })

  it("rejects subscriptions already scheduled to cancel", () => {
    expect(cancelSubscription).toContain(
      'scheduled_change_action === "cancel"'
    )
    expect(cancelSubscription).toContain(
      "Subscription already scheduled to cancel"
    )
  })
})

describe("Paddle activate subscription edge function contract", () => {
  it("authenticates before resolving the Paddle customer", () => {
    expect(activateSubscription).toContain(
      'return json({ error: "Not authenticated" }, 401)'
    )
    expect(activateSubscription).toContain('.eq("user_id", userId)')
  })

  it("only activates trialing subscriptions resolved server-side", () => {
    expect(activateSubscription).not.toContain("request.json")
    expect(activateSubscription).toContain(
      '.eq("subscription_status", "trialing")'
    )
    expect(activateSubscription).toContain("paddle.subscriptions.activate")
  })

  it("rejects subscriptions already scheduled to cancel", () => {
    expect(activateSubscription).toContain(
      'scheduled_change_action === "cancel"'
    )
    expect(activateSubscription).toContain(
      "Cannot activate a subscription scheduled to cancel"
    )
  })
})
