import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_PRICING } from "../catalog-pricing";

const landingHtml = readFileSync(
  resolve(process.cwd(), "landing/index.html"),
  "utf8"
);

describe("landing/index.html go-live readiness", () => {
  it("shows catalog-aligned ZAR prices", () => {
    expect(landingHtml).toContain(CATALOG_PRICING.monthly.display);
    expect(landingHtml).toContain(CATALOG_PRICING.yearly.display);
    expect(landingHtml).toContain(CATALOG_PRICING.yearlySavingsDisplay);
    expect(landingHtml).not.toContain("R300");
    expect(landingHtml).not.toContain("R3,000");
  });

  it("links to legal and checkout routes on the same origin", () => {
    for (const href of [
      "/pricing/",
      "/terms/",
      "/privacy/",
      "/refund/",
    ]) {
      expect(landingHtml).toContain(`href="${href}"`);
    }
  });
});
