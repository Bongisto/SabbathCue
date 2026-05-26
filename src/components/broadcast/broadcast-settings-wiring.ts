export type BroadcastOutputId = "main" | "alt"

export interface OpenBroadcastWindowArgs {
  outputId: BroadcastOutputId
  monitorIndex: number
  fullscreen: boolean
}

export function parseMonitorIndex(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function buildOpenBroadcastWindowArgs(
  outputId: BroadcastOutputId,
  selectedMonitor: string,
  fullscreen: boolean
): OpenBroadcastWindowArgs {
  return {
    outputId,
    monitorIndex: parseMonitorIndex(selectedMonitor),
    fullscreen,
  }
}

export function clampMonitorIndex(index: number, monitorCount: number): number {
  if (!Number.isFinite(index) || index < 0) return 0
  return Math.min(index, Math.max(0, monitorCount - 1))
}
