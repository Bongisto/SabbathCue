import { cn } from "@/lib/utils"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"

const SIZE_CLASS = {
  sm: "h-7",
  md: "h-10",
  lg: "h-12",
} as const

export function AppLogo({
  className,
  size = "md",
}: {
  className?: string
  size?: keyof typeof SIZE_CLASS
}) {
  return (
    <img
      src="/app-logo.png"
      alt={APP_DISPLAY_NAME}
      className={cn("w-auto object-contain", SIZE_CLASS[size], className)}
    />
  )
}
