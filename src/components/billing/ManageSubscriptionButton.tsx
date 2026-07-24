import { useState } from "react"
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createCustomerPortalSession } from "@/lib/supabase/billing"

interface ManageSubscriptionButtonProps {
  disabled?: boolean
}

export function ManageSubscriptionButton({
  disabled = false,
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const result = await createCustomerPortalSession()
    setLoading(false)
    if (!result.ok) {
      if (result.message === "No Paddle customer") {
        toast.error("Complete a subscription checkout first.")
      } else {
        toast.error(result.message)
      }
      return
    }
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener")
      await openUrl(result.url)
    } catch {
      toast.error("Could not open the billing portal.")
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || loading}
      onClick={() => void handleClick()}
    >
      <ExternalLinkIcon className="mr-1.5 size-3.5" />
      {loading ? "Opening portal..." : "Manage subscription"}
    </Button>
  )
}
