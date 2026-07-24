import { Suspense } from "react";
import { PayCheckout } from "./pay-checkout";

export default function PayPage() {
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <p className="p-16 text-muted-foreground">Loading checkout…</p>
        }
      >
        <PayCheckout />
      </Suspense>
    </main>
  );
}
