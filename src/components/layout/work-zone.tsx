import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function WorkZone({
  variant,
  label,
  className,
  style,
  children,
}: {
  variant: "production" | "bible"
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <section
      data-zone={variant}
      style={style}
      className={cn(
        "min-h-0 rounded-lg transition-colors duration-150",
        variant === "production" && "bg-zone-production",
        variant === "bible" && "bg-zone-bible",
        className,
      )}
    >
      {label ? (
        <div className="px-2 pt-1.5 text-[0.5625rem] font-medium uppercase tracking-wider text-muted-foreground/80">
          {label}
        </div>
      ) : null}
      {children}
    </section>
  )
}
