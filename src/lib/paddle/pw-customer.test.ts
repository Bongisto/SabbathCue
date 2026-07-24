import { describe, expect, it } from "vitest"
import { buildPwCustomerOption } from "./pw-customer"

describe("buildPwCustomerOption (desktop)", () => {
  it("returns pwCustomer for Paddle customer ids", () => {
    expect(buildPwCustomerOption("ctm_live")).toEqual({
      pwCustomer: { id: "ctm_live" },
    })
  })
})
