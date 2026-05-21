import { describe, expect, it } from "vitest"
import React from "react"
import { PanelEmptyState } from "./panel-empty-state"

describe("PanelEmptyState", () => {
  it("renders a valid React element with required title", () => {
    const el = <PanelEmptyState title="Empty" />
    expect(React.isValidElement(el)).toBe(true)
    expect(el.props.title).toBe("Empty")
  })

  it("accepts optional icon, description, and children", () => {
    const icon = <span data-testid="icon" />
    const el = (
      <PanelEmptyState
        icon={icon}
        title="No items"
        description="Nothing to show"
      >
        <button>Action</button>
      </PanelEmptyState>
    )
    expect(el.props.icon).toBe(icon)
    expect(el.props.title).toBe("No items")
    expect(el.props.description).toBe("Nothing to show")
    expect(el.props.children).toBeDefined()
  })

  it("renders without icon prop", () => {
    const el = <PanelEmptyState title="Just title" description="A description" />
    expect(React.isValidElement(el)).toBe(true)
    expect(el.props.icon).toBeUndefined()
  })

  it("renders without description", () => {
    const el = <PanelEmptyState title="Title only" />
    expect(el.props.description).toBeUndefined()
  })

  it("renders without children", () => {
    const el = <PanelEmptyState title="Title only" />
    expect(el.props.children).toBeUndefined()
  })

  it("does not import or reference any store modules", () => {
    const source = PanelEmptyState.toString()
    expect(source).not.toContain("useStore")
    expect(source).not.toContain("create(")
  })
})
