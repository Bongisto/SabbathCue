import { DEFAULT_PUBLIC_SITE_ORIGIN, publicSiteOrigin } from "../site-url";

/** Hostname submitted for Paddle Checkout website approval. */
export const PADDLE_CHECKOUT_DOMAIN = new URL(
  publicSiteOrigin() || DEFAULT_PUBLIC_SITE_ORIGIN
).hostname;

export const APPROVED_CHECKOUT_DOMAIN_STATUSES = new Set([
  "approved",
  "pending_review",
  "in_review",
]);

export function isCheckoutDomainApproved(status: string): boolean {
  return status === "approved";
}
