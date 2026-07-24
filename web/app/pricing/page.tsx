import type { Metadata } from "next";
import { Suspense } from "react";
import { PricingCheckout } from "./pricing-checkout";
import { SITE } from "../_lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Subscribe to ${SITE.name} Pro with localized Paddle checkout.`,
};

/**
 * Static export (GitHub Pages) cannot read per-request geo headers at runtime.
 * Paddle.js PricePreview auto-detects country from the visitor IP when
 * initialCountry is null. Set PRICING_GEO_HEADERS=1 and deploy with a server
 * runtime (not output: "export") to pass x-vercel-ip-country from headers().
 */
export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <p className="p-16 text-muted-foreground">Loading pricing…</p>
        }
      >
        <PricingCheckout initialCountry={null} />
      </Suspense>
    </main>
  );
}
