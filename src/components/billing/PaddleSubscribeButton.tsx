import { useEffect, useRef, useState } from "react"
import { CreditCardIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  onCheckoutCompleted,
  openSubscriptionCheckout,
} from "@/lib/paddle/checkout"
import { getPaddleInstance } from "@/lib/paddle/client"
import { isPaddleCheckoutConfigured } from "@/lib/paddle/config"
import { ensureFreshAuthSession } from "@/lib/supabase/billing"

interface PaddleSubscribeButtonProps {
  email: string
  userId: string
  label?: string
  onCompleted?: () => void
  disabled?: boolean
  size?: "sm" | "default"
}

export function PaddleSubscribeButton({
  email,
  userId,
  label = "Subscribe to renew",
  onCompleted,
  disabled = false,
  size = "sm",
}: PaddleSubscribeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isPaddleCheckoutConfigured()) return
    void getPaddleInstance().then((paddle) => setReady(Boolean(paddle)))
  }, [])

  // Callers pass inline arrows, so keep the latest handler in a ref and
  // subscribe once instead of re-registering on every render.
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

  async function handleClick() {
    setLoading(true)
    await ensureFreshAuthSession()
    const result = await openSubscriptionCheckout({ email, userId })
    setLoading(false)
    if (!result.ok) toast.error(result.message)
  }

  return (
    <Button
      variant="default"
      size={size}
      disabled={disabled || loading || !ready}
      onClick={() => void handleClick()}
    >
      <CreditCardIcon className="mr-1.5 size-3.5" />
      {loading ? "Opening checkout..." : label}
    </Button>
  )
}
