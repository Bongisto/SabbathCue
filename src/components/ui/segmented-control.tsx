import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SegmentOption<T extends string> {
  id: T
  label: string
  title?: string
  tourId?: string
  icon?: ReactNode
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "sm",
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  className?: string
  size?: "sm" | "xs"
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.title}
            data-tour={option.tourId}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors duration-150",
              size === "xs"
                ? "px-2.5 py-1 text-[0.6875rem]"
                : "px-3 py-1.5 text-xs",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {option.icon ? (
              <span className="inline-flex shrink-0 [&_svg]:size-3.5">{option.icon}</span>
            ) : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
