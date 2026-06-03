import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  useServiceReadiness,
  type ReadinessStatus,
} from "@/hooks/use-service-readiness"
import { CheckCircle2Icon, AlertTriangleIcon, CircleOffIcon } from "lucide-react"

const STATUS_STYLES: Record<
  ReadinessStatus,
  { icon: typeof CheckCircle2Icon; className: string }
> = {
  ready: { icon: CheckCircle2Icon, className: "text-emerald-500" },
  warning: { icon: AlertTriangleIcon, className: "text-amber-500" },
  unavailable: { icon: CircleOffIcon, className: "text-red-500" },
}

export function ServiceReadinessPanel() {
  const { checks } = useServiceReadiness()

  return (
    <section
      data-slot="service-readiness-panel"
      className="rounded-lg border border-border bg-card/80 px-3 py-2"
      aria-label="Ready for service checklist"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[0.625rem] font-medium tracking-wider text-muted-foreground uppercase">
          Ready for service
        </span>
        <span className="text-[0.5625rem] text-muted-foreground">
          Informational only
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  )
}
