/**
 * Read-only live readiness audit (no creates, no deletes).
 *
 * Usage:
 *   $env:PADDLE_LIVE_API_KEY="pdl_live_apikey_..."
 *   node web/scripts/audit-paddle-live-readiness.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECKOUT_DOMAIN = "sabbath-cue-two.vercel.app";
const SITE_ORIGIN = `https://${CHECKOUT_DOMAIN}`;
const LEGAL_PATHS = ["/terms/", "/privacy/", "/refund/", "/pricing/", "/pay/"];

function readLiveApiKey() {
  const candidates = [
    process.env.PADDLE_LIVE_API_KEY?.trim(),
    process.env.PADDLE_API_KEY?.trim(),
    existsSync(join(repoRoot, ".paddle-api-key.local"))
      ? readFileSync(join(repoRoot, ".paddle-api-key.local"), "utf8").trim()
      : "",
  ].filter(Boolean);
  return candidates.find((key) => key.startsWith("pdl_live_")) ?? null;
}

async function paddleList(apiKey, resource) {
  const url = new URL(`https://api.paddle.com/${resource}`);
  url.searchParams.set("per_page", "50");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.detail ?? `${resource} ${response.status}`);
  }
  const key = resource.replace(/-/g, "_");
  return body.data ?? body[key] ?? [];
}

async function checkUrl(path) {
  const url = `${SITE_ORIGIN}${path}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    return { url, status: response.status, ok: response.ok };
  } catch (error) {
    return { url, status: 0, ok: false, error: String(error) };
  }
}

async function main() {
  console.log("=== SabbathCue live migration readiness audit ===\n");

  console.log("## Code / local env (current committed defaults)");
  console.log("- web/.env.production.local: still sandbox (test_ token, pri_01ky9…)");
  console.log("- root .env: still sandbox");
  console.log("- Code uses env-driven pri_ IDs (no hard-coded live IDs in checkout paths)");
  console.log("- Hard-coded sandbox fallback IDs remain in trial-period.ts + ensure-paddle-access-trial.mjs only\n");

  const apiKey = readLiveApiKey();
  if (!apiKey) {
    console.log("## Live Paddle API");
    console.log(
      "SKIP — set PADDLE_LIVE_API_KEY to audit live catalog/webhooks/domains.\n"
    );
  } else {
    const [products, prices, tokens, notifications, domains] =
      await Promise.all([
        paddleList(apiKey, "products"),
        paddleList(apiKey, "prices"),
        paddleList(apiKey, "client-tokens"),
        paddleList(apiKey, "notification-settings"),
        paddleList(apiKey, "checkout-domains"),
      ]);

    console.log("## Live catalog");
    console.log(`Products (${products.length}):`);
    for (const product of products) {
      console.log(`  - ${product.id}  ${product.name}  [${product.status}]`);
    }
    console.log(`Prices (${prices.length}):`);
    for (const price of prices) {
      const za = (price.unit_price_overrides ?? []).find((o) =>
        o.country_codes?.includes("ZA")
      );
      console.log(
        `  - ${price.id}  ${price.description}  ${price.unit_price?.amount} ${price.unit_price?.currency_code}` +
          (za ? `  ZA=${za.unit_price.amount} ZAR` : "")
      );
    }

    console.log("\n## Live credentials");
    const liveTokens = tokens.filter((t) => t.status === "active");
    console.log(`Active client tokens: ${liveTokens.length}`);
    for (const token of liveTokens) {
      console.log(`  - ${token.id}  ${token.name}`);
    }

    console.log("\n## Live notification destinations");
    if (notifications.length === 0) {
      console.log("  NONE — create one before go-live (reuse secret if one exists later)");
    } else {
      for (const row of notifications) {
        console.log(
          `  - ${row.id}  active=${row.active}  ${row.destination}`
        );
      }
    }

    console.log("\n## Live checkout domains");
    const domain = domains.find((d) => d.domain === CHECKOUT_DOMAIN);
    if (!domain) {
      console.log(`  MISSING — submit ${CHECKOUT_DOMAIN} for approval`);
    } else {
      console.log(`  ${domain.domain}: ${domain.status} (${domain.id})`);
    }
  }

  console.log("\n## Public site checks");
  for (const path of LEGAL_PATHS) {
    const result = await checkUrl(path);
    console.log(
      `  ${result.ok ? "OK" : "FAIL"}  ${result.status}  ${result.url}`
    );
  }

  console.log("\n## Pricing alignment (ZAR marketing)");
  console.log("  Expected: R200/mo, R2,000/yr (catalog-pricing.ts + Paddle ZA overrides)");

  const ips = await fetch("https://api.paddle.com/ips").then((r) => r.json());
  console.log("\n## Paddle webhook IPs (from /ips)");
  console.log(`  ${ips.data?.ipv4_cidrs?.join(", ") ?? "unavailable"}`);

  console.log("\nDone. Fix FAIL rows before verification / real payments.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
