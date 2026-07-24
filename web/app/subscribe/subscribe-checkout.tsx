"use client";

import { useEffect, useState } from "react";
import {
  initializePaddle,
  type Environments,
  type Paddle,
} from "@paddle/paddle-js";
import { Button } from "../_components/ui/button";
import { Container } from "../_components/ui/container";

type WebPaddleConfig = {
  clientToken: string;
  environment: Environments;
  priceId: string;
};

function readWebPaddleConfig(): WebPaddleConfig | null {
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENV?.trim();
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim();
  if (!clientToken || !environment || !priceId) return null;
  if (environment !== "sandbox" && environment !== "production") return null;
  return { clientToken, environment, priceId };
}

// NEXT_PUBLIC_* values are inlined at build time, so the config never changes
// for the life of the bundle. Reading it per render would hand useEffect a new
// object identity every time and re-run initializePaddle on every render.
const config = readWebPaddleConfig();

export function SubscribeCheckout() {
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void initializePaddle({
      token: config.clientToken,
      environment: config.environment,
      checkout: { settings: { displayMode: "overlay", variant: "one-page" } },
    }).then((instance) => {
      if (!cancelled) setPaddle(instance ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) {
    return (
      <Container className="py-16">
        <p className="text-muted-foreground">
          Online checkout is not configured for this site build. Open SabbathCue
          on your computer and subscribe from Settings &gt; Account.
        </p>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Subscribe</h1>
        <p className="max-w-xl text-muted-foreground">
          Renew SabbathCue access after your trial. Sign in with the same email
          in the desktop app after checkout completes.
        </p>
      </div>
      <Button
        variant="primary"
        disabled={!paddle}
        onClick={() =>
          paddle?.Checkout.open({
            items: [{ priceId: config.priceId, quantity: 1 }],
          })
        }
      >
        {paddle ? "Open secure checkout" : "Loading checkout..."}
      </Button>
    </Container>
  );
}
