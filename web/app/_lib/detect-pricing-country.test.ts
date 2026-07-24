import { describe, expect, it } from "vitest";
import {
  detectCountryFromHeaderMap,
  PADDLE_AUTO_COUNTRY,
  resolvePricePreviewCountry,
} from "./detect-pricing-country";

describe("detectCountryFromHeaderMap", () => {
  it("reads x-vercel-ip-country first", () => {
    expect(
      detectCountryFromHeaderMap({
        "x-vercel-ip-country": "za",
        "cf-ipcountry": "us",
      })
    ).toBe("ZA");
  });

  it("falls back to cf-ipcountry", () => {
    expect(detectCountryFromHeaderMap({ "cf-ipcountry": "gb" })).toBe("GB");
  });

  it("ignores invalid and sentinel codes", () => {
    expect(detectCountryFromHeaderMap({ "x-vercel-ip-country": "XX" })).toBeNull();
    expect(detectCountryFromHeaderMap({ "x-vercel-ip-country": "T1" })).toBeNull();
    expect(detectCountryFromHeaderMap({ "x-vercel-ip-country": "ZAF" })).toBeNull();
  });
});

describe("resolvePricePreviewCountry", () => {
  it("returns undefined for null, OTHERS, and empty", () => {
    expect(resolvePricePreviewCountry(null)).toBeUndefined();
    expect(resolvePricePreviewCountry(PADDLE_AUTO_COUNTRY)).toBeUndefined();
    expect(resolvePricePreviewCountry("")).toBeUndefined();
  });

  it("never passes OTHERS to Paddle", () => {
    expect(resolvePricePreviewCountry("OTHERS")).toBeUndefined();
  });

  it("normalizes valid ISO codes", () => {
    expect(resolvePricePreviewCountry("za")).toBe("ZA");
  });
});
