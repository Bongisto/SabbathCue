import * as React from "react"

import { cn } from "@/lib/utils"

function PanelHeader({
  className,
  title,
  icon,
  step: _step,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  title: string
  icon?: React.ReactNode
  /** @deprecated Step numbers removed from UI; kept for API compatibility */
  step?: number
}) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex min-h-10 items-center justify-between border-b border-border bg-card px-3 transition-colors duration-150",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
        {icon ? (
          <span className="text-primary [&_svg]:size-3.5">{icon}</span>
        ) : null}
        {title}
      </span>
      {children ? (
        <div className="flex items-center gap-1">{children}</div>
      ) : null}
    </div>
  )
}

export { PanelHeader }
