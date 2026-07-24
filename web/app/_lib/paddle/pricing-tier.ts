export type BillingInterval = "month" | "year";

export interface Tier {
  name: "Pro";
  description: string;
  features: string[];
  priceId: { month: string; year: string };
}

/**
 * Static process.env.NEXT_PUBLIC_* access only — required for client-bundle
 * inlining. Dynamic process.env[name] is empty in the browser.
 */
function readMonthPriceId(): string {
  const value = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH?.trim();
  if (!value) {
    throw new Error(
      "Missing required Paddle price env var NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH. Run web/scripts/seed-paddle-sandbox-catalog.mjs or set it manually."
    );
  }
  if (!value.startsWith("pri_")) {
    throw new Error(
      `NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH must be a Paddle price id (pri_...). Got "${value}".`
    );
  }
  return value;
}

function readYearPriceId(): string {
  const value = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR?.trim();
  if (!value) {
    throw new Error(
      "Missing required Paddle price env var NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR. Run web/scripts/seed-paddle-sandbox-catalog.mjs or set it manually."
    );
  }
  if (!value.startsWith("pri_")) {
    throw new Error(
      `NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR must be a Paddle price id (pri_...). Got "${value}".`
    );
  }
  return value;
}

/** Single Pro tier — edit copy here; price IDs come from env at build time. */
export function getProTier(): Tier {
  return {
    name: "Pro",
    description:
      "Full SabbathCue access for live sermon verse display, NDI output, and cloud account sync.",
    features: [
      "Real-time verse detection during live sermons",
      "NDI broadcast-ready overlays",
      "Two activated computers per account",
      "14-day free trial on paid plans",
    ],
    priceId: {
      month: readMonthPriceId(),
      year: readYearPriceId(),
    },
  };
}

export function tierPriceIdForInterval(
  tier: Tier,
  interval: BillingInterval
): string {
  return tier.priceId[interval];
}
