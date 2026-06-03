import { lazy, Suspense, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CastIcon, ClipboardListIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useTheme } from "@/components/theme-provider"
import { AppLogo } from "@/components/ui/app-logo"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  })),
)

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  })),
)

export function TransportBar() {
  const { theme, setTheme } = useTheme()
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] = useState(false)
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)

  return (
    <div
      data-slot="transport-bar"
      className="col-span-4 flex h-14 items-center justify-between border-b border-border  bg-card px-3"
    >
      <div className="flex items-center gap-2.5">
        <AppLogo size="md" />
        <Badge variant="outline" className="text-[0.5625rem] uppercase">
          Free
        </Badge>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          title="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <SunIcon className="size-3.5 shrink-0" />
          ) : (
            <MoonIcon className="size-3.5 shrink-0" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          title="Broadcast Settings"
          data-tour="broadcast"
          onClick={() => {
            setBroadcastSettingsMounted(true)
            setBroadcastOpen(true)
          }}
        >
          <CastIcon className="size-3.5 shrink-0" />
          <span className="hidden text-xs sm:inline">Broadcast</span>
        </Button>
        {broadcastSettingsMounted && (
          <Suspense fallback={null}>
            <LazyBroadcastSettings
              open={broadcastOpen}
              onOpenChange={setBroadcastOpen}
            />
          </Suspense>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          title="Theme Designer"
          data-tour="theme"
          onClick={() => {
            setThemeDesignerMounted(true)
            useBroadcastStore.getState().setDesignerOpen(true)
          }}
        >
          <PaletteIcon className="size-3.5 shrink-0" />
          <span className="hidden text-xs sm:inline">Theme</span>
        </Button>
        {themeDesignerMounted && (
          <Suspense fallback={null}>
            <LazyThemeDesigner />
          </Suspense>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          title="Service Plan"
          onClick={() => useServicePlanStore.getState().openPlanner()}
        >
          <ClipboardListIcon className="size-3.5 shrink-0" />
          <span className="hidden text-xs sm:inline">Plan</span>
        </Button>
        <SettingsDialog />
      </div>
    </div>
  )
}
