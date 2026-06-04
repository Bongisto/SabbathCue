import { lazy, Suspense, useState } from "react"
import {
  CastIcon,
  ClipboardListIcon,
  MoonIcon,
  SunIcon,
  PaletteIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SettingsDialog } from "@/components/settings-dialog"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTheme } from "@/components/theme-provider"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  }))
)

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  }))
)

export function AppControllerHeader() {
  const { theme, setTheme } = useTheme()
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] = useState(false)
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)

  return (
    <header
      data-slot="transport-bar"
      className="controller-headboard z-50 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-4">
        <img
          src="/app-logo.png"
          alt={APP_DISPLAY_NAME}
          className="h-9 w-auto object-contain"
        />
        <div className="flex flex-col leading-none">
          <span className="font-serif text-lg tracking-wide text-foreground">
            {APP_DISPLAY_NAME}
          </span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Presentation controller
          </span>
        </div>
        <Badge
          variant="outline"
          className="hidden border-[var(--brand-border)] bg-[var(--brand-accent-glow)] text-[0.5625rem] uppercase text-[var(--brand-accent)] sm:inline-flex"
        >
          Desktop
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <SettingsDialog triggerVariant="chrome" />
        <Button
          variant="chrome"
          size="icon-sm"
          title="Broadcast settings"
          data-tour="broadcast"
          onClick={() => {
            setBroadcastSettingsMounted(true)
            setBroadcastOpen(true)
          }}
        >
          <CastIcon className="size-3.5" />
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
          variant="chrome"
          size="icon-sm"
          title="Theme designer"
          data-tour="theme"
          onClick={() => {
            setThemeDesignerMounted(true)
            useBroadcastStore.getState().setDesignerOpen(true)
          }}
        >
          <PaletteIcon className="size-3.5" />
        </Button>
        {themeDesignerMounted && (
          <Suspense fallback={null}>
            <LazyThemeDesigner />
          </Suspense>
        )}
        <Button
          variant="chrome"
          size="icon-sm"
          title="Toggle light/dark theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? (
            <SunIcon className="size-3.5" />
          ) : (
            <MoonIcon className="size-3.5" />
          )}
        </Button>
        <Button
          variant="chrome"
          size="icon-sm"
          title="Service plan"
          onClick={() => useServicePlanStore.getState().openPlanner()}
        >
          <ClipboardListIcon className="size-3.5" />
        </Button>
      </div>
    </header>
  )
}
