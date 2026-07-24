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

  useEffect(() => {
    if (!isPaddleCheckoutConfigured()) return
    void (async () => {
      const summary = await fetchMyBillingSummary()
      if (summary.ok && summary.summary.paddleCustomerId) {
        setPaddleCustomerIdForInit(summary.summary.paddleCustomerId)
      }
      const paddle = await getPaddleInstance()
      setReady(Boolean(paddle))
    })()
  }, [])

  const onCompletedRef = useRef(onCompleted)
  useEffect(() => {
    onCompletedRef.current = onCompleted
  }, [onCompleted])

  useEffect(() => {
    if (!isPaddleCheckoutConfigured()) return
    let cancelled = false
    let unsubscribe: (() => void) | null = null
    void getPaddleInstance().then((paddle) => {
      if (cancelled || !paddle) return
      unsubscribe = onCheckoutCompleted(paddle, () => {
        onCompletedRef.current?.()
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  if (!isPaddleCheckoutConfigured()) return null

  async function handleSubscribe() {
    setLoading(true)
    await ensureFreshAuthSession()
    const result = await openSubscriptionCheckout({ email, userId, interval })
    setLoading(false)
    if (!result.ok) toast.error(result.message)
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
