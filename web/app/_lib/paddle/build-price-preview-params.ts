import type { PricePreviewParams, PricePreviewResponse } from "@paddle/paddle-js";
import {
  resolvePricePreviewCountry,
  type PricingCountryInput,
} from "../detect-pricing-country";
import { getProTier, type BillingInterval, tierPriceIdForInterval } from "./pricing-tier";

export function buildPricePreviewParams(
  country: PricingCountryInput,
  interval: BillingInterval
): PricePreviewParams {
  const tier = getProTier();
  const priceId = tierPriceIdForInterval(tier, interval);
  const countryCode = resolvePricePreviewCountry(country);

  return {
    items: [{ priceId, quantity: 1 }],
    ...(countryCode ? { address: { countryCode } } : {}),
  };
}

/** Fetch both billing intervals in one preview (month + year). */
export function buildAllPricePreviewParams(
  country: PricingCountryInput
): PricePreviewParams {
  const tier = getProTier();
  const countryCode = resolvePricePreviewCountry(country);

  return {
    items: [
      { priceId: tier.priceId.month, quantity: 1 },
      { priceId: tier.priceId.year, quantity: 1 },
    ],
    ...(countryCode ? { address: { countryCode } } : {}),
  };
}

export function formattedTotalsByPriceId(
  response: PricePreviewResponse
): Record<string, string> {
  return response.data.details.lineItems.reduce<Record<string, string>>(
    (acc, item) => {
      acc[item.price.id] = item.formattedTotals.total;
      return acc;
    },
    {}
  );
}
