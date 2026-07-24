import { describe, expect, it } from "vitest";
import { buildPwCustomerOption } from "./pw-customer";

describe("buildPwCustomerOption", () => {
  it("returns pwCustomer when a Paddle customer id is present", () => {
    expect(buildPwCustomerOption("ctm_01abc")).toEqual({
      pwCustomer: { id: "ctm_01abc" },
    });
  });

  it("omits pwCustomer for empty or non-Paddle ids", () => {
    expect(buildPwCustomerOption(null)).toEqual({});
    expect(buildPwCustomerOption("user-123")).toEqual({});
    expect(buildPwCustomerOption("")).toEqual({});
  });
});
