import { useState } from "react"
import { CreditCardIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { activateSubscriptionNow } from "@/lib/supabase/billing"

interface ActivateSubscriptionButtonProps {
  disabled?: boolean
  onActivated?: () => void
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return "your next billing date"
  const when = new Date(iso)
  return Number.isNaN(when.getTime()) ? "your next billing date" : when.toLocaleDateString()
}

export function ActivateSubscriptionButton({
  disabled = false,
  onActivated,
}: ActivateSubscriptionButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleActivate() {
    setLoading(true)
    const result = await activateSubscriptionNow()
    setLoading(false)

    if (!result.ok) {
      if (result.message === "No trialing subscription") {
        toast.error("No trial subscription to activate.")
      } else if (
        result.message === "Cannot activate a subscription scheduled to cancel"
      ) {
        toast.error("Your subscription is scheduled to cancel.")
      } else {
        toast.error(result.message)
      }
      setConfirming(false)
      return
    }

    toast.success(
      `Subscription activated. You're paid through ${formatPeriodEnd(result.result.currentPeriodEnd)}.`
    )
    setConfirming(false)
    onActivated?.()
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={disabled || loading}
          onClick={() => void handleActivate()}
        >
          {loading ? "Processing..." : "Confirm and pay now"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Keep trial
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => setConfirming(true)}
    >
      <CreditCardIcon className="mr-1.5 size-3.5" />
      Start paid subscription now
    </Button>
  )
}
