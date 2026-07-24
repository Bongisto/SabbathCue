import type { Paddle } from "@paddle/paddle-js"
import {
  getPaddleCatalogConfig,
  priceIdForInterval,
  type BillingInterval,
} from "@/lib/paddle/config"
import { getPaddleInstance } from "@/lib/paddle/client"

export interface OpenSubscriptionCheckoutOptions {
  email: string
  userId: string
  interval?: BillingInterval
}

export async function openSubscriptionCheckout(
  options: OpenSubscriptionCheckoutOptions
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = getPaddleCatalogConfig()
  if (!config) {
    return {
      ok: false,
      message:
        "Checkout is not configured in this build. Contact support to renew access.",
    }
  }

  const paddle = await getPaddleInstance()
  if (!paddle) {
    return { ok: false, message: "Could not load the checkout service." }
  }

  const interval = options.interval ?? "month"
  const priceId = priceIdForInterval(config, interval)
  if (!priceId) {
    return {
      ok: false,
      message:
        interval === "year"
          ? "Yearly checkout is not configured in this build."
          : "Checkout is not configured in this build.",
    }
  }

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: options.email.trim() },
      customData: { supabase_user_id: options.userId },
    })
    return { ok: true }
  } catch {
    return { ok: false, message: "Could not open checkout." }
  }
}

// Paddle exposes a single eventCallback slot and getPaddleInstance() is a
// module singleton, so every caller has to share one callback. Registering per
// component would silently overwrite whichever button subscribed first, and
// unsubscribing would tear down the callback for everyone still listening.
const completionHandlers = new Set<() => void>()
let eventCallbackInstalled = false

export function resetCheckoutSubscribersForTests(): void {
  completionHandlers.clear()
  eventCallbackInstalled = false
}

export function onCheckoutCompleted(
  paddle: Paddle,
  handler: () => void
): () => void {
  completionHandlers.add(handler)

  if (!eventCallbackInstalled) {
    eventCallbackInstalled = true
    paddle.Update({
      eventCallback: (event: { name?: string }) => {
        if (event.name !== "checkout.completed") return
        for (const subscriber of [...completionHandlers]) subscriber()
      },
    })
  }

  return () => {
    completionHandlers.delete(handler)
  }
}
