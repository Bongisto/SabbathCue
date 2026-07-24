"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Paddle } from "@paddle/paddle-js";
import { initializePaddle } from "@paddle/paddle-js";
import { useSearchParams } from "next/navigation";
import { Button } from "../_components/ui/button";
import { Container } from "../_components/ui/container";
import {
  describePaddleCheckoutError,
  PADDLE_CHECKOUT_SETUP_HINT,
} from "../_lib/paddle/checkout-errors";
import { parsePtxnFromSearchParams } from "../_lib/paddle/checkout-query";
import { buildCheckoutSuccessUrl } from "../_lib/paddle/checkout-success-url";
import { buildSubscriptionCheckoutOpenArgs } from "../_lib/paddle/build-subscription-checkout-open";
import {
  requirePaddlePublicConfig,
  type PaddlePublicConfig,
} from "../_lib/paddle/config";
import { buildDefaultPaymentLinkUrl } from "../_lib/paddle/default-payment-link";
import { buildPaddleInitializeOptions } from "../_lib/paddle/paddle-checkout-settings";
import { BillingIntervalToggle } from "../_lib/paddle/billing-interval-toggle";
import {
  getProTier,
  type BillingInterval,
  type Tier,
} from "../_lib/paddle/pricing-tier";

function tryConfig(): PaddlePublicConfig | null {
  try {
    return requirePaddlePublicConfig();
  } catch {
    return null;
  }
}

function tryTier(): Tier | null {
  try {
    return getProTier();
  } catch {
    return null;
  }
}

const subscribeToMount = () => () => {};

export function PayCheckout() {
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const config: PaddlePublicConfig | null = useMemo(
    () => (mounted ? tryConfig() : null),
    [mounted]
  );
  const tier: Tier | null = useMemo(
    () => (mounted ? tryTier() : null),
    [mounted]
  );
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const openedTransactionId = useRef<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("month");

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void initializePaddle(
      buildPaddleInitializeOptions(config, (event) => {
        const message = describePaddleCheckoutError(
          event as { name?: string }
        );
        if (message) setCheckoutError(message);
      })
    ).then((instance) => {
      if (!cancelled) setPaddle(instance ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => {
    if (!paddle || !config) return;
    const transactionId = parsePtxnFromSearchParams(searchParams);
    if (!transactionId || openedTransactionId.current === transactionId) return;

    openedTransactionId.current = transactionId;
    paddle.Checkout.open({
      transactionId,
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: buildCheckoutSuccessUrl(config),
      },
    });
  }, [paddle, config, searchParams]);

  function openSubscriptionCheckout() {
    if (!paddle || !config || !tier) return;
    setCheckoutError(null);
    paddle.Checkout.open(buildSubscriptionCheckoutOpenArgs(tier, interval, config));
  }

  if (!mounted) {
    return (
      <Container className="py-16">
        <p className="text-muted-foreground">Loading checkout…</p>
      </Container>
    );
  }

  if (!config || !tier) {
    return (
      <Container className="py-16">
        <p className="text-muted-foreground">
          Paddle checkout is not configured. Set{" "}
          <code className="text-foreground">NEXT_PUBLIC_PADDLE_*</code> in{" "}
          <code className="text-foreground">web/.env.local</code> and restart
          the dev server.
        </p>
      </Container>
    );
  }

  const defaultPaymentLink = buildDefaultPaymentLinkUrl(config);
  const transactionId = parsePtxnFromSearchParams(searchParams);

  return (
    <Container className="flex flex-col gap-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Subscribe</h1>
        <p className="max-w-xl text-muted-foreground">
          Secure Paddle checkout for SabbathCue Access. After payment, sign in
          with the same email in the desktop app.
        </p>
      </div>

      {transactionId ? (
        <p className="text-sm text-muted-foreground">
          Opening checkout for your payment link…
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <BillingIntervalToggle interval={interval} onChange={setInterval} />
          <Button
            variant="primary"
            disabled={!paddle}
            onClick={openSubscriptionCheckout}
          >
            {paddle ? "Open secure checkout" : "Loading checkout…"}
          </Button>
        </div>
      )}

      {checkoutError ? (
        <p className="text-sm text-destructive">{checkoutError}</p>
      ) : null}

      <p className="max-w-xl text-xs text-muted-foreground">
        Paddle default payment link for this build:{" "}
        <code className="text-foreground">{defaultPaymentLink}</code>
        <br />
        {PADDLE_CHECKOUT_SETUP_HINT}
      </p>
    </Container>
  );
}
