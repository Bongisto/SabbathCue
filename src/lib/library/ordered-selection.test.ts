import { describe, expect, it } from "vitest"
import {
  pruneOrderedSelection,
  toggleOrderedSelection,
} from "./ordered-selection"

describe("toggleOrderedSelection", () => {
  it("appends a newly picked id at the end", () => {
    expect(toggleOrderedSelection([], "c")).toEqual(["c"])
    expect(toggleOrderedSelection(["c", "a"], "b")).toEqual(["c", "a", "b"])
  })

  it("removes an already-picked id and preserves the order of the rest", () => {
    expect(toggleOrderedSelection(["c", "a", "b"], "a")).toEqual(["c", "b"])
  })

  it("re-picking a removed id places it at the end", () => {
    const withoutA = toggleOrderedSelection(["c", "a", "b"], "a")
    expect(toggleOrderedSelection(withoutA, "a")).toEqual(["c", "b", "a"])
  })
})

describe("pruneOrderedSelection", () => {
  it("drops ids that are no longer present, keeping pick order", () => {
    expect(
      pruneOrderedSelection(["c", "a", "b"], new Set(["b", "c"]))
    ).toEqual(["c", "b"])
  })
})
