// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BillingIntervalToggle } from "./billing-interval-toggle"

describe("BillingIntervalToggle", () => {
  afterEach(() => {
    cleanup()
  })

  it("calls onChange when yearly is selected", () => {
    let interval: "month" | "year" = "month"
    render(
      <BillingIntervalToggle
        interval={interval}
        onChange={(next) => {
          interval = next
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^yearly$/i }))
    expect(interval).toBe("year")
  })

  it("disables yearly when yearlyAvailable is false", () => {
    render(
      <BillingIntervalToggle
        interval="month"
        onChange={() => {}}
        yearlyAvailable={false}
      />
    )

    expect(
      (screen.getByRole("button", { name: /^yearly$/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
