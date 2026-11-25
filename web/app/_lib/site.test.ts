import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StructuredData } from "../_components/seo/structured-data";
import manifest from "../manifest";
import robots from "../robots";
import sitemap from "../sitemap";
import { SITE, publicBasePath } from "./site";

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;
const ORIGINAL_SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN;

function restoreEnv() {
  if (ORIGINAL_BASE_PATH === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  } else {
    process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH;
  }
  if (ORIGINAL_SITE_ORIGIN === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
  } else {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = ORIGINAL_SITE_ORIGIN;
  }
}

describe("web site, basePath, and SEO URLs", () => {
  afterEach(() => {
    restoreEnv();
    vi.unstubAllEnvs();
  });

  it("uses the public site origin instead of the GitHub repo URL while preserving repo links", () => {
    expect(SITE.url).toBe("https://sabbath-cue-two.vercel.app");
    expect(SITE.repoUrl).toBe("https://github.com/Bongisto/SabbathCue");
    expect(SITE.repo.url).toBe("https://github.com/Bongisto/SabbathCue");
    expect(SITE.socials.github).toBe("https://github.com/Bongisto/SabbathCue");
  });

  it("normalizes basePath matching web/next.config.ts", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(publicBasePath()).toBe("/SabbathCue");

    process.env.NEXT_PUBLIC_BASE_PATH = "";
    expect(publicBasePath()).toBe("");

    process.env.NEXT_PUBLIC_BASE_PATH = "/";
    expect(publicBasePath()).toBe("");

    process.env.NEXT_PUBLIC_BASE_PATH = "/SabbathCue/";
    expect(publicBasePath()).toBe("/SabbathCue");
  });

  it("prefixes manifest start_url and icon src with configured basePath", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    const ghManifest = manifest();
    expect(ghManifest.start_url).toBe("/SabbathCue/");
    expect(ghManifest.icons?.[0]?.src).toBe("/SabbathCue/sabbathcue-icon.png");

    process.env.NEXT_PUBLIC_BASE_PATH = "";
    const rootManifest = manifest();
    expect(rootManifest.start_url).toBe("/");
    expect(rootManifest.icons?.[0]?.src).toBe("/sabbathcue-icon.png");
  });

  it("emits publicSiteOrigin() in robots, sitemap, and JSON-LD", () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://custom.sabbathcue.org/";

    const robotsDoc = robots();
    expect(robotsDoc.sitemap).toBe("https://custom.sabbathcue.org/sitemap.xml");
    expect(robotsDoc.host).toBe("https://custom.sabbathcue.org");

    const sitemapEntries = sitemap();
    expect(sitemapEntries[0]?.url).toBe("https://custom.sabbathcue.org/");

    const html = renderToStaticMarkup(StructuredData());
    const jsonMatch = html.match(/<script[^>]*>([\s\S]*)<\/script>/);
    expect(jsonMatch?.[1]).toBeTruthy();
    const graph = JSON.parse(jsonMatch![1])["@graph"] as Array<Record<string, unknown>>;
    expect(graph[0]?.url).toBe("https://custom.sabbathcue.org");
    expect((graph[0]?.logo as Record<string, unknown>)?.url).toBe(
      "https://custom.sabbathcue.org/sabbathcue-logo.png"
    );
    expect(graph[0]?.sameAs).toEqual(["https://github.com/Bongisto/SabbathCue"]);
    expect(graph[1]?.url).toBe("https://custom.sabbathcue.org");
    expect(graph[2]?.url).toBe("https://custom.sabbathcue.org");
  });

  it("wires basePath into layout manifest and Fumadocs static search api", () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), "web/app/layout.tsx"),
      "utf8"
    );
    expect(layoutSource).toContain("manifest: `${basePath}/manifest.webmanifest`");
    expect(layoutSource).toContain("api: `${basePath}/api/search`");
    expect(layoutSource).toContain("metadataBase: new URL(siteOrigin)");
  });
});
