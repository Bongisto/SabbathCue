import type { MetadataRoute } from "next";
import { SITE, publicBasePath } from "./_lib/site";

export const dynamic = "force-static";

/**
 * Next prefixes routes and next/image with basePath automatically, but not
 * manifest URLs — they carry the prefix by hand. Same rule as next.config.ts:
 * GitHub Pages serves under /SabbathCue, Vercel sets NEXT_PUBLIC_BASE_PATH="".
 */
export default function manifest(): MetadataRoute.Manifest {
  const basePath = publicBasePath();
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#f5f7fa",
    icons: [
      {
        src: `${basePath}/sabbathcue-icon.png`,
        sizes: "1280x1280",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
