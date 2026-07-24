"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useSearchParams } from "next/navigation";
import { Button } from "../_components/ui/button";
import { Container } from "../_components/ui/container";
import { EftPaymentPanel } from "../_components/billing/eft-payment-panel";
import type { PricingCountryInput } from "../_lib/detect-pricing-country";
import { buildCheckoutSuccessUrl } from "../_lib/paddle/checkout-success-url";
import { describePaddleCheckoutError } from "../_lib/paddle/checkout-errors";
import {
  requirePaddlePublicConfig,
  type PaddlePublicConfig,
} from "../_lib/paddle/config";
import { buildPaddleInitializeOptions } from "../_lib/paddle/paddle-checkout-settings";
import { fetchSignedInPaddleCustomerId } from "../_lib/paddle/fetch-paddle-customer-id";
import { buildAllPricePreviewParams } from "../_lib/paddle/build-price-preview-params";
import { BillingIntervalToggle } from "../_lib/paddle/billing-interval-toggle";
import {
  getProTier,
  tierPriceIdForInterval,
  type BillingInterval,
  type Tier,
} from "../_lib/paddle/pricing-tier";
import { usePaddlePrices } from "../_lib/paddle/use-paddle-prices";
import { getSupabaseClient } from "../_lib/supabase-client";

type PricingCheckoutProps = {
  initialCountry: PricingCountryInput;
};

function tryPaddlePublicConfig(): PaddlePublicConfig | null {
  try {
    return requirePaddlePublicConfig();
  } catch {
    return null;
  }
}

function tryProTier(): Tier | null {
  try {
    return getProTier();
  } catch {
    return null;
  }
}

function BillingToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  return <BillingIntervalToggle interval={interval} onChange={onChange} />;
}

const subscribeToMount = () => () => {};

/**
 * Gate config-dependent UI until after mount. Next can re-read NEXT_PUBLIC_*
 * on the server after .env.local changes while the client bundle still has the
 * previous (empty) inlined values — that mismatch caused a hydration error.
 */
export function PricingCheckout({ initialCountry }: PricingCheckoutProps) {
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const config: PaddlePublicConfig | null = useMemo(
    () => (mounted ? tryPaddlePublicConfig() : null),
    [mounted]
  );
  const tier: Tier | null = useMemo(
    () => (mounted ? tryProTier() : null),
    [mounted]
  );
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval | null>(null);
  const interval: BillingInterval =
    selectedInterval ?? (searchParams.get("interval") === "year" ? "year" : "month");
  const [customerEmail, setCustomerEmail] = useState<string | undefined>();
  const [paddleCustomerId, setPaddleCustomerId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const previewParams = useMemo(() => {
    if (!tier) return null;
    try {
      return buildAllPricePreviewParams(initialCountry);
    } catch {
      return null;
    }
  }, [tier, initialCountry]);
  const { prices, loading, error } = usePaddlePrices(paddle, previewParams);

  const activePriceId = tier ? tierPriceIdForInterval(tier, interval) : "";
  const displayedTotal = activePriceId ? prices[activePriceId] : undefined;

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void initializePaddle(
      buildPaddleInitializeOptions(
        config,
        (event) => {
          const message = describePaddleCheckoutError(
            event as { name?: string }
          );
          if (message) setCheckoutError(message);
        },
        { paddleCustomerId }
      )
    ).then((instance) => {
      if (!cancelled) setPaddle(instance ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [config, paddleCustomerId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email?.trim();
        if (!cancelled && email) setCustomerEmail(email);
        const customerId = await fetchSignedInPaddleCustomerId();
        if (!cancelled) setPaddleCustomerId(customerId);
      } catch {
        /* optional prefill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openCheckout() {
    if (!paddle || !config || !activePriceId) return;
    setCheckoutError(null);
    paddle.Checkout.open({
      items: [{ priceId: activePriceId, quantity: 1 }],
      ...(customerEmail ? { customer: { email: customerEmail } } : {}),
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: buildCheckoutSuccessUrl(config),
      },
    });
  }

  if (!mounted) {
    return (
      <Container className="flex flex-col gap-10 py-16 lg:py-24">
        <p className="text-muted-foreground">Loading pricing…</p>
      </Container>
    );
  }

  if (!config || !tier) {
    return (
      <Container className="py-16">
        <p className="text-muted-foreground">
          Paddle checkout is not configured yet. From the repo root run:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border-strong p-4 text-sm">
          {`bun run paddle:setup:ps1`}
        </pre>
        <p className="mt-4 text-muted-foreground">
          Then stop and restart the dev server (
          <code className="text-foreground">bun run dev</code> in{" "}
          <code className="text-foreground">web/</code>) so{" "}
          <code className="text-foreground">NEXT_PUBLIC_*</code> env vars reload.
        </p>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-10 py-16 lg:py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
            Pricing
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Localized totals from Paddle. The amount shown is what checkout
            charges — includes tax where applicable.
          </p>
        </div>
        <BillingToggle interval={interval} onChange={setSelectedInterval} />
      </div>

      <article className="flex max-w-xl flex-col gap-6 border border-border-strong p-8 md:p-10">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            {tier.name}
          </p>
          <p className="text-[34px] font-medium leading-none tracking-[-0.04em] text-foreground">
            {loading ? "…" : (displayedTotal ?? "—")}
          </p>
          <p className="text-sm text-muted-foreground">
            {interval === "month" ? "Per month" : "Per year"} · 14-day trial
          </p>
          <p className="text-lg leading-8 text-muted-foreground">
            {tier.description}
          </p>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          {tier.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span aria-hidden className="text-accent">
                ✓
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {checkoutError ? (
          <p className="text-sm text-destructive">{checkoutError}</p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          disabled={!paddle || loading || !displayedTotal}
          onClick={openCheckout}
        >
          {!paddle
            ? "Loading checkout…"
            : loading
              ? "Loading prices…"
              : "Subscribe with Paddle"}
        </Button>
      </article>

      <div className="relative max-w-xl py-2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border-strong" />
        <p className="relative mx-auto w-fit bg-background px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          or
        </p>
      </div>

      <div className="max-w-xl">
        <EftPaymentPanel interval={interval} accountEmail={customerEmail} />
      </div>
    </Container>
  );
}
