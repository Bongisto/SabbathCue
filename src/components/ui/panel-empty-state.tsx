import * as React from "react"

import { cn } from "@/lib/utils"

function PanelEmptyState({
  className,
  icon,
  title,
  description,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="panel-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="text-muted-foreground/50">{icon}</div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-serif text-sm font-medium tracking-wide text-foreground/80">
          {title}
        </p>
        {description && (
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

export { PanelEmptyState }
