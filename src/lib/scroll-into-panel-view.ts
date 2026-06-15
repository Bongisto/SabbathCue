/**
 * Scroll an element into view by adjusting only its nearest scrollable
 * ancestor, never the page. `Element.scrollIntoView` scrolls every scrollable
 * ancestor including the document, which yanks the whole app down to the
 * Bible section when a detection is previewed.
 */

function isScrollable(element: HTMLElement): boolean {
  if (element.scrollHeight <= element.clientHeight) return false
  const { overflowY } = getComputedStyle(element)
  return overflowY === "auto" || overflowY === "scroll"
}

function isWorkspaceScroller(element: HTMLElement): boolean {
  return element.dataset.slot === "workspace-scroll"
}

export function findScrollContainer(element: Element): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    if (isWorkspaceScroller(parent)) return null
    if (isScrollable(parent)) return parent
    parent = parent.parentElement
  }
  return null
}

export function scrollIntoPanelView(element: Element | null): void {
  if (!element) return
  const container = findScrollContainer(element)
  if (!container) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const offset =
    elementRect.top -
    containerRect.top -
    (containerRect.height - elementRect.height) / 2

  container.scrollTo({ top: container.scrollTop + offset, behavior: "smooth" })
}
