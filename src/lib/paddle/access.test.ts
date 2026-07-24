import { describe, expect, it } from "vitest"
import { subscriptionStatusGrantsAccess } from "./access"

describe("subscriptionStatusGrantsAccess", () => {
  it("grants access for active and trialing", () => {
    expect(subscriptionStatusGrantsAccess("active")).toBe(true)
    expect(subscriptionStatusGrantsAccess("trialing")).toBe(true)
  })

  it("denies access during past_due — no dunning grace", () => {
    expect(subscriptionStatusGrantsAccess("past_due")).toBe(false)
  })

  it("denies access when paused or canceled", () => {
    expect(subscriptionStatusGrantsAccess("paused")).toBe(false)
    expect(subscriptionStatusGrantsAccess("canceled")).toBe(false)
  })

  it("denies access for null or unknown statuses", () => {
    expect(subscriptionStatusGrantsAccess(null)).toBe(false)
    expect(subscriptionStatusGrantsAccess(undefined)).toBe(false)
    expect(subscriptionStatusGrantsAccess("unknown")).toBe(false)
  })
})
