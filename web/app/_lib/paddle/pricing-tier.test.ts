import { afterEach, describe, expect, it } from "vitest";
import { getProTier, tierPriceIdForInterval } from "./pricing-tier";

const PRICE_ENV = [
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH",
  "NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR",
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

describe("getProTier", () => {
  const saved = snapshotEnv();

  afterEach(() => restoreEnv(saved));

  it("exposes a single Pro tier with month and year price IDs from env", () => {
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH = "pri_month_01";
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR = "pri_year_01";

    const tier = getProTier();
    expect(tier.name).toBe("Pro");
    expect(tier.features.length).toBeGreaterThan(0);
    expect(tierPriceIdForInterval(tier, "month")).toBe("pri_month_01");
    expect(tierPriceIdForInterval(tier, "year")).toBe("pri_year_01");
  });

  it("throws when price env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH;
    delete process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR;
    expect(() => getProTier()).toThrow(/NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH/);
  });
});
