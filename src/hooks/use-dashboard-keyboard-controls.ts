import { useEffect } from "react"
import { commitPreviewToLive } from "@/lib/presentation-workflow"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import {
  clearLiveOutput,
  clearPreviewOutput,
  toggleLiveOutputVisibility,
  toggleTranscription,
} from "@/lib/operator-actions"
import { useQueueStore } from "@/stores/queue-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTutorialStore } from "@/stores/tutorial-store"
import {
  advanceCurrentPresentationTarget,
  isPresentationNavigationEditableTarget,
} from "@/lib/presentation-panel-navigation"

function selectQueueItem(delta: number): void {
  const queue = useQueueStore.getState()
  if (queue.items.length === 0) return

  const fallbackIndex = delta > 0 ? -1 : queue.items.length
  const nextIndex = Math.max(
    0,
    Math.min(
      queue.items.length - 1,
      (queue.activeIndex ?? fallbackIndex) + delta
    )
  )
  const item = queue.items[nextIndex]
  if (!item) return

  queue.setActive(nextIndex)
  previewQueuedItem(item)
}

function presentActiveQueueItem(): void {
  const queue = useQueueStore.getState()
  const index = queue.activeIndex ?? 0
  const item = queue.items[index]
  if (!item) return

  queue.setActive(index)
  presentQueuedItem(item)
}

function handleWorkspaceShortcut(key: string): boolean {
  if (key === "1") {
    useDashboardWorkspaceStore.getState().setWorkspace("live")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "2") {
    useDashboardWorkspaceStore.getState().setWorkspace("service-plans")
    useServicePlanStore.getState().openPlanner()
    return true
  }
  if (key === "3") {
    useDashboardWorkspaceStore.getState().setWorkspace("run-service")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "4") {
    useDashboardWorkspaceStore.getState().setWorkspace("hymns")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "5") {
    useDashboardWorkspaceStore.getState().setWorkspace("library")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "6") {
    useDashboardWorkspaceStore.getState().setWorkspace("queue")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  return false
}

function handleArrowShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    if (event.key === "ArrowRight") return advanceCurrentPresentationTarget(1)
    if (event.key === "ArrowLeft") return advanceCurrentPresentationTarget(-1)
  }

  if (event.altKey && event.key === "ArrowRight") {
    void useServicePlanStore.getState().goToNextItem()
    return true
  }
  if (event.altKey && event.key === "ArrowLeft") {
    void useServicePlanStore.getState().goToPreviousItem()
    return true
  }
  if (event.altKey && event.key === "ArrowDown") {
    selectQueueItem(1)
    return true
  }
  if (event.altKey && event.key === "ArrowUp") {
    selectQueueItem(-1)
    return true
  }
  return false
}

function handleCommandShortcut(event: KeyboardEvent, key: string): boolean {
  const mod = event.ctrlKey || event.metaKey
  if (!mod) return false

  if (event.key === "Enter" && event.shiftKey) {
    presentActiveQueueItem()
    return true
  }
  if (event.key === "Enter") {
    commitPreviewToLive()
    return true
  }
  if (key === "l") {
    toggleLiveOutputVisibility()
    return true
  }
  if (event.shiftKey && key === "x") {
    clearLiveOutput()
    return true
  }
  if (event.shiftKey && key === "p") {
    clearPreviewOutput()
    return true
  }
  if (key === "m") {
    toggleTranscription()
    return true
  }
  return false
}

export function useDashboardKeyboardControls(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleDashboardKeyboardEvent)
    return () =>
      window.removeEventListener("keydown", handleDashboardKeyboardEvent)
  }, [])
}

export function handleDashboardKeyboardEvent(event: KeyboardEvent): void {
  if (
    event.defaultPrevented ||
    event.repeat ||
    isPresentationNavigationEditableTarget(event.target)
  )
    return
  if (useTutorialStore.getState().isRunning) return

  const key = event.key.toLowerCase()
  const mod = event.ctrlKey || event.metaKey
  const workspaceMod = mod || event.altKey

  if (workspaceMod && !event.shiftKey && handleWorkspaceShortcut(key)) {
    event.preventDefault()
    return
  }

  if (handleArrowShortcut(event)) {
    event.preventDefault()
    return
  }

  if (handleCommandShortcut(event, key)) {
    event.preventDefault()
  }
}
