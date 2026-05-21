import { describe, expect, it } from "vitest"
import React from "react"
import { PanelHeader } from "./panel-header"

describe("PanelHeader", () => {
  it("renders a valid React element without step", () => {
    const el = <PanelHeader title="Live Transcript" />
    expect(React.isValidElement(el)).toBe(true)
    expect(el.props.title).toBe("Live Transcript")
    expect(el.props.step).toBeUndefined()
  })

  it("accepts an optional step prop", () => {
    const el = <PanelHeader title="Queue" step={3} />
    expect(el.props.step).toBe(3)
  })

  it("passes children through", () => {
    const el = <PanelHeader title="Test">child node</PanelHeader>
    expect(el.props.children).toBe("child node")
  })

  it("passes className through", () => {
    const el = <PanelHeader title="Test" className="custom" />
    expect(el.props.className).toBe("custom")
  })

  it("supports all six dashboard panel step values", () => {
    for (let step = 1; step <= 6; step++) {
      const el = <PanelHeader title={`Panel ${step}`} step={step} />
      expect(el.props.step).toBe(step)
    }
  })
})
