import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

// scripts/generate-fumadocs-source.mjs owns .source generation. Skipping the
// package init avoids Fumadocs' esbuild config compile walking above this repo
// on Windows shells with restricted parent-directory access.
process.env._FUMADOCS_MDX = "1";

const nextConfig: NextConfig = {
  output: "export",
  // Served as a GitHub Pages project site under /SabbathCue/. Next prefixes
  // routes and next/image automatically; CSS url() values and manifest.ts
  // do NOT get rewritten and carry the prefix by hand.
  basePath: "/SabbathCue",
  trailingSlash: true,
  // The default next/image loader requires a server runtime; with
  // output: "export" we ship every image through the static pipeline,
  // so disable the optimizer and let the browser fetch assets as-is.
  images: { unoptimized: true },
  turbopack: {
    root: webRoot,
  },
  experimental: {
    optimizePackageImports: ["@tabler/icons-react", "lucide-react"],
  },
};

const withMDX = createMDX({
  configPath: "source.config.ts",
});

export default withMDX(nextConfig);
