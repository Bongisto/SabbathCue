import * as React from "react"

import { cn } from "@/lib/utils"

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  options: SegmentedControlOption<T>[]
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-white/5 bg-slate-900/60 p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all",
              active
                ? "border border-[var(--brand-border)] bg-[var(--brand-accent-glow)] text-[var(--brand-accent)] shadow-sm"
                : "border border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
