import { afterEach, describe, expect, it } from "vitest";
import { buildSubscriptionCheckoutOpenArgs } from "./build-subscription-checkout-open";
import type { PaddlePublicConfig } from "./config";
import type { Tier } from "./pricing-tier";

const PRICE_ENV = [
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH",
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR",
  "NEXT_PUBLIC_BASE_PATH",
  "NEXT_PUBLIC_SITE_ORIGIN",
] as const;

function snapshotEnv() {
  return Object.fromEntries(PRICE_ENV.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of PRICE_ENV) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("buildSubscriptionCheckoutOpenArgs", () => {
  const saved = snapshotEnv();

  afterEach(() => restoreEnv(saved));

  it("uses the yearly price id when interval is year", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/SabbathCue";
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "http://localhost:3029";

    const tier: Tier = {
      name: "Pro",
      description: "Test",
      features: [],
      priceId: { month: "pri_month_test", year: "pri_year_test" },
    };
    const config: PaddlePublicConfig = {
      clientToken: "test_token",
      environment: "sandbox",
      basePath: "/SabbathCue",
    };

    expect(buildSubscriptionCheckoutOpenArgs(tier, "year", config)).toEqual({
      items: [{ priceId: "pri_year_test", quantity: 1 }],
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: "http://localhost:3029/SabbathCue/welcome/",
      },
    });
  });
});
