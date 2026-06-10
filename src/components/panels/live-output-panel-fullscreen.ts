export function isPanelFullscreen(
  panel: Element | null,
  fullscreenElement: Element | null,
): boolean {
  return panel !== null && fullscreenElement === panel
}

/**
 * Layout state the panel should adopt after a toggle. Applied optimistically
 * (before the async fullscreen request resolves) so the panel never paints a
 * frame with windowed chrome at fullscreen size, which reads as a flash.
 */
export function nextFullscreenLayout(
  panel: Element | null,
  fullscreenElement: Element | null,
): boolean {
  return panel !== null && !isPanelFullscreen(panel, fullscreenElement)
}

export async function togglePanelFullscreen(
  panel: HTMLElement | null,
  fullscreenElement: Element | null,
  exitFullscreen: () => Promise<void>,
  onLayoutChange?: (fullscreen: boolean) => void,
): Promise<void> {
  if (!panel) return

  const entering = nextFullscreenLayout(panel, fullscreenElement)
  onLayoutChange?.(entering)
  try {
    if (entering) {
      await panel.requestFullscreen()
    } else {
      await exitFullscreen()
    }
  } catch (error) {
    // Roll the optimistic layout back so the panel chrome matches reality.
    onLayoutChange?.(!entering)
    throw error
  }
}

