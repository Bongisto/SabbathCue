import { cn } from "@/lib/utils"
import { DASHBOARD_WORKSPACE_NAV_GROUPS } from "@/lib/dashboard-workspace-nav"
import {
  useDashboardWorkspaceStore,
  type DashboardWorkspace,
} from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

export function WorkspaceSidebar() {
  const workspace = useDashboardWorkspaceStore((s) => s.workspace)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const closePlanner = useServicePlanStore((s) => s.closePlanner)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)

  const selectWorkspace = (id: DashboardWorkspace, opensPlanner?: boolean) => {
    if (opensPlanner) {
      setWorkspace("service-plans")
      openPlanner()
      return
    }
    closePlanner()
    setWorkspace(id)
  }

  return (
    <aside
      data-slot="workspace-sidebar"
      className="controller-sidebar flex w-[210px] shrink-0 flex-col border-r border-white/[0.06] backdrop-blur-md"
    >
      <nav className="flex flex-1 flex-col py-3" aria-label="Workspaces">
        {DASHBOARD_WORKSPACE_NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {groupIndex > 0 && (
              <div
                className="sidebar-nav-divider mx-5 my-2 h-px bg-white/5"
                role="separator"
              />
            )}
            <p className="sidebar-nav-group-label px-5 pb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = workspace === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => selectWorkspace(item.id, item.opensPlanner)}
                  className={cn(
                    "controller-nav-item btn-tactile flex items-center gap-3 border-l-4 px-5 py-3 text-left text-xs font-medium transition-all",
                    active && "active",
                    active
                      ? "border-[var(--brand-accent)] text-foreground"
                      : "border-transparent text-muted-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-[var(--brand-accent)]" : "opacity-70"
                    )}
                  />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.06] bg-black/20 p-4">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="tracking-wide">System online</span>
        </div>
      </div>
    </aside>
  )
}
