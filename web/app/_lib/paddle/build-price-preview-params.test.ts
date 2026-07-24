import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PricePreviewResponse } from "@paddle/paddle-js";
import {
  buildAllPricePreviewParams,
  buildPricePreviewParams,
  formattedTotalsByPriceId,
} from "./build-price-preview-params";

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

describe("buildPricePreviewParams", () => {
  const saved = snapshotEnv();

  afterEach(() => restoreEnv(saved));

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH = "pri_month_test";
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR = "pri_year_test";
  });

  it("includes country when provided", () => {
    const params = buildPricePreviewParams("ZA", "month");
    expect(params).toEqual({
      items: [{ priceId: "pri_month_test", quantity: 1 }],
      address: { countryCode: "ZA" },
    });
  });

  it("omits country when null so Paddle auto-detects from IP", () => {
    const params = buildAllPricePreviewParams(null);
    expect(params.address).toBeUndefined();
    expect(params.items).toHaveLength(2);
  });

  it("never sends OTHERS as a country code", () => {
    const params = buildPricePreviewParams("OTHERS", "year");
    expect(params.address).toBeUndefined();
    expect(params.items[0].priceId).toBe("pri_year_test");
  });
});

describe("formattedTotalsByPriceId", () => {
  it("maps Paddle formattedTotals without reformatting", () => {
    const response = {
      data: {
        details: {
          lineItems: [
            {
              price: { id: "pri_month_test" },
              formattedTotals: { total: "R200.00" },
            },
            {
              price: { id: "pri_year_test" },
              formattedTotals: { total: "R2,000.00" },
            },
          ],
        },
      },
    } as unknown as PricePreviewResponse;

    expect(formattedTotalsByPriceId(response)).toEqual({
      pri_month_test: "R200.00",
      pri_year_test: "R2,000.00",
    });
  });
});
