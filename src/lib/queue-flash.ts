import { scrollIntoPanelView } from "@/lib/scroll-into-panel-view"
import { useQueueStore } from "@/stores/queue-store"

/**
 * Flash the existing queue item for a verse and scroll the queue panel to it.
 * No-op when the verse is not actually queued.
 */
export function flashQueuedVerse(
  bookNumber: number,
  chapter: number,
  verse: number
): void {
  const store = useQueueStore.getState()
  const idx = store.findDuplicate(bookNumber, chapter, verse)
  if (idx === -1) return
  store.flashItem(store.items[idx].id)
  scrollIntoPanelView(
    document.querySelector(`[data-slot="queue-panel"] [data-queue-idx="${idx}"]`)
  )
}
