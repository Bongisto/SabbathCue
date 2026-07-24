import type { PaddlePublicConfig } from "./config";

/** Origin for absolute Paddle URLs (server render or local dev fallback). */
export function resolvePaddleSiteOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "http://localhost:3029"
  ).replace(/\/$/, "");
}

/**
 * URL to register in Paddle → Checkout → Default payment link.
 * Must include Paddle.js and open checkout for ?_ptxn= transaction links.
 */
export function buildDefaultPaymentLinkUrl(config: PaddlePublicConfig): string {
  const basePath = config.basePath.replace(/\/$/, "");
  return `${resolvePaddleSiteOrigin()}${basePath}/pay/`;
}
