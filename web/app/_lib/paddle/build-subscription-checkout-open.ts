import { buildCheckoutSuccessUrl } from "./checkout-success-url";
import type { PaddlePublicConfig } from "./config";
import {
  tierPriceIdForInterval,
  type BillingInterval,
  type Tier,
} from "./pricing-tier";

export function buildSubscriptionCheckoutOpenArgs(
  tier: Tier,
  interval: BillingInterval,
  config: PaddlePublicConfig
) {
  return {
    items: [{ priceId: tierPriceIdForInterval(tier, interval), quantity: 1 }],
    settings: {
      displayMode: "overlay" as const,
      variant: "one-page" as const,
      successUrl: buildCheckoutSuccessUrl(config),
    },
  };
}
