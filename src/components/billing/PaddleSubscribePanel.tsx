import { useEffect, useRef, useState } from "react"
import { CreditCardIcon } from "lucide-react"
import { toast } from "sonner"
import { BillingIntervalToggle } from "@/components/billing/BillingIntervalToggle"
import { Button } from "@/components/ui/button"
import {
  onCheckoutCompleted,
  openSubscriptionCheckout,
} from "@/lib/paddle/checkout"
import {
  getPaddleInstance,
  setPaddleCustomerIdForInit,
} from "@/lib/paddle/client"
import {
  isPaddleCheckoutConfigured,
  isYearlyCheckoutAvailable,
  type BillingInterval,
} from "@/lib/paddle/config"
import {
  ensureFreshAuthSession,
  fetchMyBillingSummary,
} from "@/lib/supabase/billing"

interface PaddleSubscribePanelProps {
  email: string
  userId: string
  onCompleted?: () => void
  disabled?: boolean
}

export function PaddleSubscribePanel({
  email,
  userId,
  onCompleted,
  disabled = false,
}: PaddleSubscribePanelProps) {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [interval, setInterval] = useState<BillingInterval>("month")
  const yearlyAvailable = isYearlyCheckoutAvailable()

  const onCompletedRef = useRef(onCompleted)
  useEffect(() => {
    onCompletedRef.current = onCompleted
  }, [onCompleted])

  useEffect(() => {
    if (!isPaddleCheckoutConfigured()) return
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void (async () => {
      try {
        const summary = await fetchMyBillingSummary()
        if (cancelled) return
        if (summary.ok && summary.summary.paddleCustomerId) {
          setPaddleCustomerIdForInit(summary.summary.paddleCustomerId)
        }
      } catch {
        if (cancelled) return
      }

      try {
        const paddle = await getPaddleInstance()
        if (cancelled) return
        setReady(Boolean(paddle))
        if (paddle) {
          unsubscribe = onCheckoutCompleted(paddle, () => {
            onCompletedRef.current?.()
          })
        }
      } catch {
        if (!cancelled) setReady(false)
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  if (!isPaddleCheckoutConfigured()) return null

  async function handleSubscribe() {
    setLoading(true)
    try {
      try {
        await ensureFreshAuthSession()
      } catch {
        // Proceed to checkout even if session refresh throws.
      }
      const result = await openSubscriptionCheckout({ email, userId, interval })
      if (!result.ok) toast.error(result.message)
    } catch {
      toast.error("Could not open checkout.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BillingIntervalToggle
        interval={interval}
        onChange={setInterval}
        yearlyAvailable={yearlyAvailable}
      />
      <Button
        variant="default"
        size="sm"
        disabled={disabled || loading || !ready}
        onClick={() => void handleSubscribe()}
      >
        <CreditCardIcon className="mr-1.5 size-3.5" />
        {loading ? "Opening checkout..." : "Subscribe or renew"}
      </Button>
    </div>
  )
}
