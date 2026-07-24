/**
 * Verifies a deployed origin actually serves the hybrid artifact that
 * scripts/vercel-build.mjs produces: landing/index.html at "/" AND the Next.js
 * static export underneath it.
 *
 * test-vercel-build.mjs proves dist/ is correct on disk. This proves the origin
 * is serving that dist/ — a deploy whose Root Directory points at landing/
 * passes the first check and fails this one with every route but "/" 404ing.
 *
 * Run: node scripts/verify-deployed-site.mjs [origin]
 */

const DEFAULT_ORIGIN = "https://sabbath-cue-two.vercel.app";

/** Routes emitted by web/ and copied into dist/ by the Vercel build. */
const EXPORT_ROUTES = [
  "/pricing/",
  "/pay/",
  "/welcome/",
  "/terms/",
  "/privacy/",
  "/refund/",
];

/** Root files only the Next export emits — cheapest "is the export here?" tripwire. */
const EXPORT_FILES = [
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/icon.png",
];

/** Copied from landing/assets by the Vercel build. */
const LANDING_ASSETS = [
  "/assets/sabbathcue-demo.mp4",
  "/assets/afrikaans-live-test.mp4",
];

const failures = [];

function pass(label, detail) {
  console.log(`  ok    ${label}${detail ? `  ${detail}` : ""}`);
}

function fail(label, reason) {
  console.log(`  FAIL  ${label}  ${reason}`);
  failures.push(`${label}: ${reason}`);
}

async function request(url, method) {
  try {
    const res = await fetch(url, { method, redirect: "follow" });
    return { res, redirected: res.url !== url ? res.url : null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Follows redirects: the export is built with trailingSlash, hosts may strip it. */
async function checkOk(origin, path, { method = "GET", mustContain } = {}) {
  const url = `${origin}${path}`;
  const { res, redirected, error } = await request(url, method);

  if (error) {
    fail(path, `request failed (${error})`);
    return null;
  }
  if (!res.ok) {
    fail(path, `HTTP ${res.status}`);
    return null;
  }

  const via = redirected ? `→ ${redirected}` : "";
  if (!mustContain) {
    pass(path, via);
    return res;
  }

  const body = await res.text();
  const missing = mustContain.filter((needle) => !body.includes(needle));
  if (missing.length > 0) {
    fail(path, `HTTP 200 but body is missing ${missing.map((m) => JSON.stringify(m)).join(", ")}`);
    return null;
  }

  pass(path, via);
  return res;
}

async function main() {
  const origin = (
    process.argv[2] ||
    process.env.NEXT_PUBLIC_SITE_ORIGIN ||
    DEFAULT_ORIGIN
  )
    .trim()
    .replace(/\/+$/, "");

  console.log(`Verifying deployed site: ${origin}\n`);

  console.log("Homepage (landing/index.html overwrites the Next export index):");
  await checkOk(origin, "/", {
    mustContain: ['href="/pricing/"', 'href="/terms/"'],
  });

  console.log("\nNext.js export routes:");
  for (const route of EXPORT_ROUTES) {
    // /_next/static proves this is the real export, not a host fallback page.
    await checkOk(origin, route, { mustContain: ["/_next/static/"] });
  }

  console.log("\nNext.js export root files:");
  for (const file of EXPORT_FILES) {
    await checkOk(origin, file, { method: "HEAD" });
  }

  console.log("\nLanding assets:");
  for (const asset of LANDING_ASSETS) {
    await checkOk(origin, asset, { method: "HEAD" });
  }

  if (failures.length === 0) {
    console.log(`\nOK: ${origin} serves the landing homepage and the full checkout export.`);
    return;
  }

  console.error(`\nFAIL: ${failures.length} check(s) failed on ${origin}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nIf only / passes, the deployment is landing/ alone. The Vercel project must" +
      "\nbuild from the repo root: Root Directory blank, Build Command" +
      "\n`npm run build:vercel`, Output Directory `dist`."
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
