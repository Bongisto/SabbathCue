import { describe, expect, it } from "vitest";
import {
  describePaddleCheckoutError,
  PADDLE_CHECKOUT_SETUP_HINT,
} from "./checkout-errors";

describe("describePaddleCheckoutError", () => {
  it("returns setup hint for checkout.error events", () => {
    const message = describePaddleCheckoutError({ name: "checkout.error" });
    expect(message).toContain("Checkout could not open");
    expect(message).toContain(PADDLE_CHECKOUT_SETUP_HINT);
  });

  it("returns null for unrelated events", () => {
    expect(describePaddleCheckoutError({ name: "checkout.loaded" })).toBeNull();
  });
});
