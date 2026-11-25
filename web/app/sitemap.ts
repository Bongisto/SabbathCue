import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "./_lib/site-url";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteOrigin = publicSiteOrigin();
  return [
    {
      url: `${siteOrigin}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
