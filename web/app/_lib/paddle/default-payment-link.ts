import type { PaddlePublicConfig } from "./config";

export function resolvePaddleSiteOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "http://localhost:3029"
  ).replace(/\/$/, "");
}

export function buildDefaultPaymentLinkUrl(config: PaddlePublicConfig): string {
  const basePath = config.basePath.replace(/\/$/, "");
  return `${resolvePaddleSiteOrigin()}${basePath}/pay/`;
}
