import * as React from "react"

import { cn } from "@/lib/utils"

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ConfidenceRing({
  className,
  confidence,
  size = "md",
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & {
  confidence: number
  size?: "sm" | "md"
}) {
  const clamped = Math.min(Math.max(confidence, 0), 1)
  const percent = Math.round(clamped * 100)

  return (
    <svg
      data-slot="confidence-ring"
      viewBox="0 0 24 24"
      role="meter"
      aria-label="Detection confidence"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}% confidence`}
      className={cn(
        "shrink-0 -rotate-90",
        size === "sm" ? "size-4" : "size-5",
        className
      )}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r={RADIUS}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="3"
      />
      <circle
        cx="12"
        cy="12"
        r={RADIUS}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        className={cn(
          "transition-[stroke-dashoffset] duration-500",
          confidence > 0.8
            ? "stroke-[var(--accent)] drop-shadow-[0_0_3px_var(--accent-glow)]"
            : confidence >= 0.5
              ? "stroke-confidence-mid"
              : "stroke-confidence-low"
        )}
      />
    </svg>
  )
}

export { ConfidenceRing }
