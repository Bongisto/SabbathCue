const COUNTRY_HEADER_CANDIDATES = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
] as const;

/** Two-letter ISO country code from edge/CDN headers, or null when unknown. */
export function detectCountryFromHeaderMap(
  headers: Readonly<Record<string, string | undefined>>
): string | null {
  for (const name of COUNTRY_HEADER_CANDIDATES) {
    const raw = headers[name]?.trim();
    if (!raw) continue;
    const code = raw.toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1") {
      return code;
    }
  }
  return null;
}

/** App-side sentinel: never pass this string to Paddle as a country code. */
export const PADDLE_AUTO_COUNTRY = "OTHERS" as const;

export type PricingCountryInput = string | null | typeof PADDLE_AUTO_COUNTRY;

/** Country code for Paddle PricePreview, or undefined to let Paddle infer from IP. */
export function resolvePricePreviewCountry(
  country: PricingCountryInput
): string | undefined {
  if (!country || country === PADDLE_AUTO_COUNTRY) return undefined;
  const code = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return undefined;
  return code;
}
