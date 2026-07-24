import { afterEach, describe, expect, it } from "vitest";
import {
  buildOverlayCheckoutSettings,
  buildPaddleInitializeOptions,
} from "./paddle-checkout-settings";
import type { PaddlePublicConfig } from "./config";

describe("paddle-checkout-settings", () => {
  const config: PaddlePublicConfig = {
    clientToken: "test_sandbox_token",
    environment: "sandbox",
    basePath: "/SabbathCue",
  };

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  });

  it("includes overlay settings and successUrl", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "http://localhost:3029";
    const settings = buildOverlayCheckoutSettings(config);
    expect(settings.displayMode).toBe("overlay");
    expect(settings.variant).toBe("one-page");
    expect(settings.successUrl).toBe(
      "http://localhost:3029/SabbathCue/welcome/"
    );
  });

  it("passes token, environment, optional pwCustomer, and eventCallback", () => {
    const events: unknown[] = [];
    const options = buildPaddleInitializeOptions(
      config,
      (event) => {
        events.push(event);
      },
      { paddleCustomerId: "ctm_01abc" }
    );
    expect(options.token).toBe("test_sandbox_token");
    expect(options.environment).toBe("sandbox");
    expect(options.pwCustomer).toEqual({ id: "ctm_01abc" });
    expect(options.checkout.settings.displayMode).toBe("overlay");
    options.eventCallback?.({ name: "checkout.loaded" });
    expect(events).toHaveLength(1);
  });
});
