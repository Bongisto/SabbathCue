/**
 * Ordered pick-list selection: ids are kept in the order they were picked,
 * so pick position N becomes queue position N when the selection is queued.
 */
export function toggleOrderedSelection(
  selected: string[],
  id: string
): string[] {
  return selected.includes(id)
    ? selected.filter((entry) => entry !== id)
    : [...selected, id]
}

/** Drop picked ids that no longer exist, preserving pick order. */
export function pruneOrderedSelection(
  selected: string[],
  presentIds: ReadonlySet<string>
): string[] {
  return selected.filter((id) => presentIds.has(id))
}
