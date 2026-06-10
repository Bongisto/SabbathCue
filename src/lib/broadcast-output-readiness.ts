import type { BroadcastOutputSettingsModel } from "@/hooks/use-broadcast-output-settings"
import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"

export function canEnableBroadcastOutput(
  model: Pick<
    BroadcastOutputSettingsModel,
    "enabled" | "outputType" | "ndiActive"
  >,
  monitors: MonitorInfo[],
  ndiSdkInstalled: boolean,
): boolean {
  if (model.enabled) return true
  if (model.outputType === "display") {
    return monitors.length > 0
  }
  return ndiSdkInstalled || model.ndiActive
}

export function broadcastOutputBlockedReason(
  model: Pick<
    BroadcastOutputSettingsModel,
    "enabled" | "outputType" | "ndiActive"
  >,
  monitors: MonitorInfo[],
  ndiSdkInstalled: boolean,
): string | null {
  if (canEnableBroadcastOutput(model, monitors, ndiSdkInstalled)) return null
  if (model.outputType === "display") {
    return "Connect a display, then refresh monitors."
  }
  return "Install the NDI SDK before starting this output."
}
