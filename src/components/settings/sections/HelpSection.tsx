import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { useAppUpdate } from "@/hooks/use-app-update"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { useTutorialStore } from "@/stores/tutorial-store"
import { GraduationCapIcon, KeyIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

export function HelpSection() {
  const { state, loadVersion, check } = useAppUpdate()
  const [checkingManual, setCheckingManual] = useState(false)

  useEffect(() => {
    if (!isTauriRuntime()) return
    void loadVersion()
  }, [loadVersion])

  async function handleCheckForUpdates() {
    setCheckingManual(true)
    const result = await check()
    setCheckingManual(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.available) {
      toast.info(`Update ${result.update?.version ?? ""} is available.`, {
        description:
          "Restart the app from the update prompt when you are ready.",
      })
      return
    }

    toast.success("You are on the latest version.")
  }
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Resources to help you get the most out of {APP_DISPLAY_NAME}.
        </p>
      </div>

      <div className="space-y-3">
        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCapIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Interactive Tutorial</p>
              <p className="text-xs text-muted-foreground">
                Step-by-step walkthrough of every feature
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              useTutorialStore.getState().startTutorial()
            }}
          >
            <GraduationCapIcon className="mr-1.5 size-3.5" />
            Restart
          </Button>
        </div>

        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <KeyIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Keyboard Shortcuts</p>
              <p className="text-xs text-muted-foreground">
                Arrow keys navigate the tutorial, Esc to dismiss
              </p>
            </div>
          </div>
        </div>

        {isTauriRuntime() ? (
          <div className="glass-panel flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">App version</p>
              <p className="text-xs text-muted-foreground">
                {state.currentVersion
                  ? `v${state.currentVersion}`
                  : "Loading version..."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={checkingManual || state.phase === "checking"}
              onClick={() => void handleCheckForUpdates()}
            >
              <RefreshCwIcon className="mr-1.5 size-3.5" />
              Check for updates
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
