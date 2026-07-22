import * as React from "react"

import { cn } from "@/lib/utils"

function LevelMeter({
  className,
  level,
  bars = 4,
  ...props
}: React.ComponentProps<"div"> & {
  level: number
  bars?: number
}) {
  const scaled = Math.min(level / 0.25, 1)
  const curved = Math.pow(scaled, 0.4)
  const litCount = Math.round(curved * bars)

  return (
    <div
      data-slot="level-meter"
      className={cn("flex items-end gap-px", className)}
      role="meter"
      aria-valuenow={Math.round(curved * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Microphone level"
      {...props}
    >
      {Array.from({ length: bars }, (_, i) => {
        const active = i < litCount

        return (
          <span
            key={i}
            data-active={active ? "true" : "false"}
            className="level-meter-bar w-0.75 origin-bottom rounded-sm"
            style={{ height: `${6 + i * 2.5}px` }}
          />
        )
      })}
    </div>
  )
}

export { LevelMeter }
