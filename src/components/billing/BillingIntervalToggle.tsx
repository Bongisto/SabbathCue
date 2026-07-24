import type { BillingInterval } from "@/lib/paddle/config"
import { cn } from "@/lib/utils"

interface BillingIntervalToggleProps {
  interval: BillingInterval
  onChange: (next: BillingInterval) => void
  yearlyAvailable?: boolean
  className?: string
}

export function BillingIntervalToggle({
  interval,
  onChange,
  yearlyAvailable = true,
  className,
}: BillingIntervalToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-[var(--border-subtle)] p-1",
        className
      )}
      role="group"
      aria-label="Billing frequency"
    >
      {(["month", "year"] as const).map((value) => {
        const disabled = value === "year" && !yearlyAvailable
        return (
          <button
            key={value}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              interval === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50"
            )}
            aria-pressed={interval === value}
            disabled={disabled}
            onClick={() => onChange(value)}
          >
            {value === "month" ? "Monthly" : "Yearly"}
          </button>
        )
      })}
    </div>
  )
}
