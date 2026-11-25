// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HymnalPanel } from "./hymnal-panel"
import type { Hymn, HymnSearchResult } from "@/types"

const { HYMN_1, HYMN_2, INDEX, getHymnByIdMock } = vi.hoisted(() => {
  const HYMN_1: Hymn = {
    id: "sda-1",
    number: 1,
    title: "Praise to the Lord",
    category: "Adoration",
    sections: [
      { id: "v1", kind: "verse", label: "Verse 1", lines: ["Praise to the Lord", "Amen", "Amen"] },
      { id: "ref", kind: "refrain", label: "Refrain", afterVerseNumber: 1, lines: ["Hallelujah", "Hallelujah"] },
      { id: "v2", kind: "verse", label: "Verse 2", lines: ["Glory be to God"] },
    ],
  }

  const HYMN_2: Hymn = {
    id: "sda-2",
    number: 2,
    title: "All Creatures of Our God",
    category: "Adoration",
    sections: [{ id: "v1", kind: "verse", label: "Verse 1", lines: ["All creatures"] }],
  }

  const INDEX: HymnSearchResult[] = [
    { id: "sda-1", number: 1, title: "Praise to the Lord" },
    { id: "sda-2", number: 2, title: "All Creatures of Our God" },
  ]

  return { HYMN_1, HYMN_2, INDEX, getHymnByIdMock: vi.fn() }
})

vi.mock("@/data/sda-hymnal-index", () => ({
  SDA_HYMNAL_INDEX: INDEX,
}))

vi.mock("@/services/hymnal/hymnal-repository", () => ({
  getHymnById: (...args: unknown[]) => getHymnByIdMock(...args),
  getInitialHymns: () => INDEX,
  searchHymns: () => INDEX,
  preloadHymnById: vi.fn(),
}))

vi.mock("@/services/hymnal/hymnal-history", () => ({
  getRecentHymns: () => [],
  addRecentHymn: vi.fn(),
  getFavoriteHymns: () => [],
  toggleFavoriteHymn: vi.fn(),
}))

vi.mock("@/lib/presentation-workflow", () => ({
  presentItem: vi.fn(),
  selectPreviewItem: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getHymnByIdMock.mockImplementation(async (id: string) => {
    if (id === "sda-1") return HYMN_1
    if (id === "sda-2") return HYMN_2
    return null
  })
})

afterEach(() => cleanup())

describe("HymnalPanel (FU-40)", () => {
  it("renders repeated lyric lines without duplicate-key warnings and uses text-neutral-50 on bg-black", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<HymnalPanel />)

    await waitFor(() => {
      expect(screen.getAllByText("Amen")).toHaveLength(2)
    })

    const previewBox = screen.getByText("Praise to the Lord").closest("div")?.parentElement
    expect(previewBox?.className).toContain("bg-black")
    expect(screen.getByText("Praise to the Lord").parentElement?.className).toContain("text-neutral-50")
    expect(screen.getByText("Praise to the Lord").parentElement?.className).not.toContain("text-foreground")

    const duplicateKeyCalls = errSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("same key"))
    )
    expect(duplicateKeyCalls).toHaveLength(0)
    errSpy.mockRestore()
  })

  it("handles initial load failure and selectHymn race/rejection without sticking loading state", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    getHymnByIdMock.mockRejectedValueOnce(new Error("initial fail"))

    render(<HymnalPanel />)

    await waitFor(() => {
      expect(screen.getByText("No hymn selected")).toBeTruthy()
    })

    let rejectSlow!: (err: Error) => void
    const slowPromise = new Promise<Hymn | null>((_, reject) => {
      rejectSlow = reject
    })
    getHymnByIdMock.mockReturnValueOnce(slowPromise)
    getHymnByIdMock.mockResolvedValueOnce(HYMN_2)

    fireEvent.click(screen.getByRole("button", { name: /#1 Praise to the Lord/i }))
    fireEvent.click(screen.getByRole("button", { name: /#2 All Creatures of Our God/i }))

    await waitFor(() => {
      expect(screen.getAllByText("#2 All Creatures of Our God").length).toBeGreaterThanOrEqual(2)
    })

    // Late rejection from slow hymn #1 must not wipe out hymn #2 or stick loading.
    rejectSlow(new Error("late failure"))
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.getAllByText("#2 All Creatures of Our God").length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText("Loading hymn")).toBeNull()
    errSpy.mockRestore()
  })

  it("enables Restore all when selectedSectionIds differs from defaultSelectedSectionIds even with equal length", async () => {
    render(<HymnalPanel />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore all" })).toBeTruthy()
    })

    const restoreBtn = screen.getByRole("button", { name: "Restore all" }) as HTMLButtonElement
    expect(restoreBtn.disabled).toBe(true)

    // Uncheck Verse 1 (leaves 2 sections: Refrain, Verse 2), then click Repeat refrain (3 sections: Refrain, Refrain, Verse 2 -> length 3 === sections.length!)
    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByRole("button", { name: "Repeat refrain" }))

    expect(restoreBtn.disabled).toBe(false)

    fireEvent.click(restoreBtn)
    expect(restoreBtn.disabled).toBe(true)
  })
})
