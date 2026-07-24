import type { BillingInterval } from "./pricing-tier";
import { cn } from "../utils";

export function BillingIntervalToggle({
  interval,
  onChange,
  yearlyAvailable = true,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
  yearlyAvailable?: boolean;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border-strong p-1"
      role="group"
      aria-label="Billing frequency"
    >
      {(["month", "year"] as const).map((value) => {
        const disabled = value === "year" && !yearlyAvailable;
        return (
          <button
            key={value}
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
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
        );
      })}
    </div>
  );
}
