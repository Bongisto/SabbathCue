import { afterEach, describe, expect, it } from "vitest";
import { buildDefaultPaymentLinkUrl } from "./default-payment-link";
import type { PaddlePublicConfig } from "./config";

describe("buildDefaultPaymentLinkUrl", () => {
  const config: PaddlePublicConfig = {
    clientToken: "test_token",
    environment: "sandbox",
    basePath: "/SabbathCue",
  };

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  it("builds pay URL with site origin and basePath on the server", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "http://localhost:3029";
    expect(buildDefaultPaymentLinkUrl(config)).toBe(
      "http://localhost:3029/SabbathCue/pay/"
    );
  });
});
