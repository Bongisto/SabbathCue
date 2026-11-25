// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QuickVerseSearch } from "./QuickVerseSearch"
import type { Verse } from "@/types"

const noop = vi.fn()

const verse: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "John",
  chapter: 1,
  verse: 1,
  text: "In the beginning was the Word.",
}

function renderSearch(input: string, suggestion: string) {
  return render(
    <QuickVerseSearch
      quickInput={input}
      quickSuggestion={suggestion}
      quickVersesList={[verse]}
      shouldShowVerseDropdown={false}
      quickInputRef={{ current: null }}
      onQuickInputChange={noop}
      onQuickKeyDown={noop}
      onQuickVerseClick={noop}
    />
  )
}

afterEach(() => cleanup())

describe("QuickVerseSearch ghost suggestion", () => {
  it("renders a suffix for prefix matches only", () => {
    renderSearch("jo", "John 1:1")

    expect(screen.getByTestId("quick-search-ghost").textContent).toContain(
      "hn 1:1"
    )
  })

  it("does not render ghost text for normalized mismatches or cleared input", () => {
    const { rerender } = renderSearch("1 j", "I John 1:1")
    expect(screen.queryByTestId("quick-search-ghost")).toBeNull()

    rerender(
      <QuickVerseSearch
        quickInput=""
        quickSuggestion="John 1:1"
        quickVersesList={[verse]}
        shouldShowVerseDropdown={false}
        quickInputRef={{ current: null }}
        onQuickInputChange={noop}
        onQuickKeyDown={noop}
        onQuickVerseClick={noop}
      />
    )
    expect(screen.queryByTestId("quick-search-ghost")).toBeNull()
  })

  it("uses semantic elevated surface classes for the verse dropdown (FU-44)", () => {
    const { container } = render(
      <QuickVerseSearch
        quickInput="John 1:"
        quickSuggestion=""
        quickVersesList={[verse]}
        shouldShowVerseDropdown={true}
        quickInputRef={{ current: null }}
        onQuickInputChange={noop}
        onQuickKeyDown={noop}
        onQuickVerseClick={noop}
      />
    )

    const dropdown = container.querySelector(".backdrop-blur-md")
    expect(dropdown?.className).toContain("bg-[var(--bg-elevated)]")
    expect(dropdown?.className).toContain("text-foreground")
    expect(dropdown?.className).not.toContain("bg-[rgba(2,3,7,0.95)]")
  })
})
