import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "../_components/ui/container";
import { Button } from "../_components/ui/button";
import { SITE } from "../_lib/site";

export const metadata: Metadata = {
  title: "Welcome",
  description: `Thanks for subscribing to ${SITE.name}.`,
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return (
    <main className="min-h-screen">
      <Container className="flex max-w-xl flex-col gap-6 py-16">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">Subscription active</p>
          <h1 className="text-3xl font-medium tracking-tight">Welcome to {SITE.name}</h1>
          <p className="text-muted-foreground">
            Your payment succeeded. Sign in to the desktop app with the same email
            you used at checkout, then choose Retry if access has not refreshed yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/" variant="primary">
            Back to home
          </Button>
          <Link
            href="/docs/getting-started/installation/"
            className="inline-flex items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Installation guide
          </Link>
        </div>
      </Container>
    </main>
  );
}
