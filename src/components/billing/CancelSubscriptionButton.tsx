import { useState } from "react"
import { BanIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cancelSubscriptionAtPeriodEnd } from "@/lib/supabase/billing"

interface CancelSubscriptionButtonProps {
  disabled?: boolean
  onBillingStateChanged?: () => void
}

function formatCancelDate(iso: string | null): string {
  if (!iso) return "the end of your current period"
  const when = new Date(iso)
  return Number.isNaN(when.getTime()) ? "the end of your current period" : when.toLocaleDateString()
}

export function CancelSubscriptionButton({
  disabled = false,
  onBillingStateChanged,
}: CancelSubscriptionButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    const result = await cancelSubscriptionAtPeriodEnd()
    setLoading(false)

    if (!result.ok) {
      if (result.message === "Subscription already scheduled to cancel") {
        toast.message("Your subscription is already scheduled to cancel.")
        // This button only renders when our summary says the subscription is
        // NOT scheduled to cancel, so this response means the summary is stale.
        // Reload it or the UI keeps offering a cancel the server will reject.
        onBillingStateChanged?.()
      } else if (result.message === "No cancellable subscription") {
        toast.error("No active subscription to cancel.")
      } else {
        toast.error(result.message)
      }
      setConfirming(false)
      return
    }

    toast.success(
      `Renewal canceled. Access continues until ${formatCancelDate(result.result.scheduledChange)}.`
    )
    setConfirming(false)
    onBillingStateChanged?.()
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={disabled || loading}
          onClick={() => void handleCancel()}
        >
          {loading ? "Canceling..." : "Confirm cancel renewal"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Keep subscription
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
      <BanIcon className="mr-1.5 size-3.5" />
      Cancel subscription
    </Button>
  )
}
