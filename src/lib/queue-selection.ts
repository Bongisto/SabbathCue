export interface QueueSelection {
  anchorId: string | null
  ids: string[]
}

export function emptySelection(): QueueSelection {
  return { anchorId: null, ids: [] }
}

function pruneToOrder(ids: string[], orderedIds: string[]): string[] {
  const present = new Set(orderedIds)
  return ids.filter((id) => present.has(id))
}

export function applySelectionClick(
  current: QueueSelection,
  orderedIds: string[],
  targetId: string,
  mods: { ctrl: boolean; shift: boolean },
): QueueSelection {
  const ids = pruneToOrder(current.ids, orderedIds)
  const anchorId =
    current.anchorId && orderedIds.includes(current.anchorId)
      ? current.anchorId
      : null

  if (mods.shift && anchorId) {
    const from = orderedIds.indexOf(anchorId)
    const to = orderedIds.indexOf(targetId)
    if (from !== -1 && to !== -1) {
      const [start, end] = from <= to ? [from, to] : [to, from]
      return { anchorId, ids: orderedIds.slice(start, end + 1) }
    }
  }

  if (mods.ctrl) {
    return ids.includes(targetId)
      ? { anchorId, ids: ids.filter((id) => id !== targetId) }
      : { anchorId, ids: [...ids, targetId] }
  }

  return { anchorId: targetId, ids: [targetId] }
}

export function computeDrop(
  orderedIds: string[],
  selection: string[],
  sourceId: string,
  targetId: string,
): { movingIds: string[]; insertAt: number } | null {
  if (sourceId === targetId) return null
  const movingIds = selection.includes(sourceId)
    ? orderedIds.filter((id) => selection.includes(id))
    : [sourceId]
  const moving = new Set(movingIds)
  const remaining = orderedIds.filter((id) => !moving.has(id))
  const insertAt = remaining.indexOf(targetId)
  if (insertAt === -1) return null
  return { movingIds, insertAt }
}
