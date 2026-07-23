import { lazy, Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { useBroadcastDesignerStore } from "@/stores/broadcast/designer-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { PaletteIcon, SparklesIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useColorModeStore } from "@/stores/color-mode-store"

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  }))
)

export function ThemeSection() {
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)
  const darkSurface = useColorModeStore((state) => state.darkSurface)
  const setDarkSurface = useColorModeStore((state) => state.setDarkSurface)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-4">
        <p className="text-sm font-medium text-foreground">Dark appearance</p>
        <p className="mt-1 text-[0.625rem] text-muted-foreground">
          Choose one dark surface independently of the accent color.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
            Charcoal
            <Switch
              aria-label="Charcoal dark mode"
              checked={darkSurface === "charcoal"}
              onCheckedChange={(checked) => {
                if (checked) setDarkSurface("charcoal")
              }}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
            Warm obsidian
            <Switch
              aria-label="Warm obsidian dark mode"
              checked={darkSurface === "warm"}
              onCheckedChange={(checked) => {
                if (checked) setDarkSurface("warm")
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Theme designer
            </p>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Adjust lyric layouts, lower thirds, fonts, backgrounds, and text
              positioning in the full-screen theme workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                useDashboardWorkspaceStore
                  .getState()
                  .setWorkspace("kinetic-themes")
              }}
            >
              <SparklesIcon className="size-3.5" />
              Open themes
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setThemeDesignerMounted(true)
                useBroadcastDesignerStore.getState().setDesignerOpen(true)
              }}
            >
              <PaletteIcon className="size-3.5" />
              Open theme designer
            </Button>
          </div>
        </div>
      </div>

      {themeDesignerMounted ? (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      ) : null}
    </div>
  )
}
