import { describe, expect, it } from "vitest";
import {
  CATALOG_PRICING,
  catalogPricingSummaryLine,
} from "./catalog-pricing";

describe("catalog-pricing", () => {
  it("matches Paddle ZAR catalog amounts", () => {
    expect(CATALOG_PRICING.monthly.paddleAmountZar).toBe("20000");
    expect(CATALOG_PRICING.yearly.paddleAmountZar).toBe("200000");
  });

  it("annual savings equals two monthly payments", () => {
    const monthly = Number(CATALOG_PRICING.monthly.paddleAmountZar);
    const yearly = Number(CATALOG_PRICING.yearly.paddleAmountZar);
    expect(monthly * 12 - yearly).toBe(40000);
    expect(CATALOG_PRICING.yearlySavingsDisplay).toBe("R400");
  });

  it("formats marketing summary line", () => {
    expect(catalogPricingSummaryLine()).toBe("R200/mo or R2,000/yr");
  });
});
