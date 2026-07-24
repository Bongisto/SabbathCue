import { describe, expect, it } from "vitest";
import {
  PADDLE_CHECKOUT_DOMAIN,
  isCheckoutDomainApproved,
} from "./checkout-domain";

describe("checkout-domain", () => {
  it("targets the Vercel marketing hostname", () => {
    expect(PADDLE_CHECKOUT_DOMAIN).toBe("sabbath-cue-two.vercel.app");
  });

  it("recognizes approved Paddle status", () => {
    expect(isCheckoutDomainApproved("approved")).toBe(true);
    expect(isCheckoutDomainApproved("pending_review")).toBe(false);
  });
});
