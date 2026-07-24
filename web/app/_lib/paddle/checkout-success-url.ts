import type { PaddlePublicConfig } from "./config";

/** Absolute success URL for Paddle overlay checkout (respects Next basePath). */
export function buildCheckoutSuccessUrl(config: PaddlePublicConfig): string {
  const basePath = config.basePath.replace(/\/$/, "");
  if (typeof window === "undefined") {
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "http://localhost:3029";
    return `${siteOrigin.replace(/\/$/, "")}${basePath}/welcome/`;
  }
  return `${window.location.origin}${basePath}/welcome/`;
}
