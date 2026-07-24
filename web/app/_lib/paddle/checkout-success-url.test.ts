import { afterEach, describe, expect, it } from "vitest";
import { buildCheckoutSuccessUrl } from "./checkout-success-url";
import type { PaddlePublicConfig } from "./config";

describe("buildCheckoutSuccessUrl", () => {
  const config: PaddlePublicConfig = {
    clientToken: "test_token",
    environment: "sandbox",
    basePath: "/SabbathCue",
  };

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  it("builds welcome URL with basePath on the server", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "http://localhost:3029";
    expect(buildCheckoutSuccessUrl(config)).toBe(
      "http://localhost:3029/SabbathCue/welcome/"
    );
  });
});
