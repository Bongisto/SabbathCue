/** Canonical marketing / checkout origin (Vercel production). */
export const DEFAULT_PUBLIC_SITE_ORIGIN =
  "https://sabbath-cue-two.vercel.app";

export function publicSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN
  ).replace(/\/$/, "");
}
