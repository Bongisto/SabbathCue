import { describe, expect, it } from "vitest"
import { applySelectionClick, computeDrop, emptySelection } from "@/lib/queue-selection"

const ids = ["a", "b", "c", "d", "e"]
const none = { ctrl: false, shift: false }

describe("applySelectionClick", () => {
  it("plain click selects only the target and anchors it", () => {
    const next = applySelectionClick(emptySelection(), ids, "b", none)
    expect(next).toEqual({ anchorId: "b", ids: ["b"] })
  })

  it("ctrl-click toggles membership without moving the anchor", () => {
    let sel = applySelectionClick(emptySelection(), ids, "b", none)
    sel = applySelectionClick(sel, ids, "d", { ctrl: true, shift: false })
    expect(sel.ids).toEqual(["b", "d"])
    sel = applySelectionClick(sel, ids, "b", { ctrl: true, shift: false })
    expect(sel.ids).toEqual(["d"])
    expect(sel.anchorId).toBe("b")
  })

  it("shift-click selects the range from anchor to target in queue order", () => {
    let sel = applySelectionClick(emptySelection(), ids, "d", none)
    sel = applySelectionClick(sel, ids, "a", { ctrl: false, shift: true })
    expect(sel.ids).toEqual(["a", "b", "c", "d"])
    expect(sel.anchorId).toBe("d")
  })

  it("ignores ids no longer in the queue", () => {
    const stale = { anchorId: "zz", ids: ["zz", "c"] }
    const next = applySelectionClick(stale, ids, "a", { ctrl: true, shift: false })
    expect(next.ids).toEqual(["c", "a"])
  })
})

describe("computeDrop", () => {
  it("dropping a selected card moves the whole selection before the target", () => {
    expect(computeDrop(ids, ["a", "c"], "a", "e")).toEqual({
      movingIds: ["a", "c"],
      insertAt: 2, // among remaining [b, d, e]: before e
    })
  })

  it("dropping an unselected card moves just that card", () => {
    expect(computeDrop(ids, ["a"], "d", "b")).toEqual({
      movingIds: ["d"],
      insertAt: 1,
    })
  })

  it("returns null for a no-op drop", () => {
    expect(computeDrop(ids, [], "b", "b")).toBeNull()
  })
})
