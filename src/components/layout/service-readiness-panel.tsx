import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  useServiceReadiness,
  type ReadinessStatus,
} from "@/hooks/use-service-readiness"
import {
  CheckCircle2Icon,
  AlertTriangleIcon,
  CircleOffIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react"

export const READINESS_COLLAPSED_STORAGE_KEY = "sabbathcue.readinessCollapsed.v1"

const STATUS_STYLES: Record<
  ReadinessStatus,
  { icon: typeof CheckCircle2Icon; className: string }
> = {
  ready: { icon: CheckCircle2Icon, className: "text-primary" },
  warning: { icon: AlertTriangleIcon, className: "text-brand-yellow" },
  unavailable: { icon: CircleOffIcon, className: "text-red-500" },
}

function loadCollapsedPreference(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = window.localStorage.getItem(READINESS_COLLAPSED_STORAGE_KEY)
    if (raw === null) return true
    return raw === "true"
  } catch {
    return true
  }
}

function saveCollapsedPreference(collapsed: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(READINESS_COLLAPSED_STORAGE_KEY, String(collapsed))
  } catch {
    // Ignore storage failures.
  }
}

export function ServiceReadinessPanel({ className }: { className?: string }) {
  const { checks } = useServiceReadiness()
  const [collapsed, setCollapsed] = useState(loadCollapsedPreference)

  useEffect(() => {
    saveCollapsedPreference(collapsed)
  }, [collapsed])

  const readyCount = checks.filter((c) => c.status === "ready").length
  const warningCount = checks.filter((c) => c.status === "warning").length
  const unavailableCount = checks.filter((c) => c.status === "unavailable").length

  const summaryParts: string[] = [
    `${readyCount}/${checks.length} ready`,
  ]
  if (warningCount > 0) summaryParts.push(`${warningCount} warning`)
  if (unavailableCount > 0) summaryParts.push(`${unavailableCount} blocked`)

  return (
    <section
      data-slot="service-readiness-panel"
      className={cn(
        "rounded-lg border border-border bg-card/80 shrink-0",
        className,
      )}
      aria-label="Ready for service checklist"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? (
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[0.625rem] font-medium tracking-wider text-muted-foreground uppercase">
          Ready for service
        </span>
        <span className="text-xs text-foreground">{summaryParts.join(" · ")}</span>
        <span className="ml-auto text-[0.5625rem] text-muted-foreground">
          {collapsed ? "Expand" : "Collapse"}
        </span>
      </button>

      {!collapsed && (
        <ul className="grid gap-1.5 border-t border-border/60 px-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => {
            const style = STATUS_STYLES[check.status]
            const Icon = style.icon
            return (
              <li
                key={check.id}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-background/50 px-2 py-1.5"
              >
                <Icon className={cn("mt-0.5 size-3.5 shrink-0", style.className)} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {check.label}
                  </div>
                  <div className="text-[0.625rem] text-muted-foreground">
                    {check.detail}
                  </div>
                  {check.actionLabel && check.onAction ? (
                    <Button
                      size="xs"
                      variant="outline"
                      className="mt-1 h-6 text-[0.625rem]"
                      onClick={check.onAction}
                    >
                      {check.actionLabel}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
