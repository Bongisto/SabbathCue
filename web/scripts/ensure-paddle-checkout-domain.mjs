/**
 * Verify Paddle checkout website approval for the marketing domain.
 *
 * Usage (sandbox):
 *   node web/scripts/ensure-paddle-checkout-domain.mjs
 *
 * Usage (live — before taking real payments):
 *   $env:PADDLE_API_KEY="pdl_live_apikey_..."
 *   $env:PADDLE_ENV="production"
 *   node web/scripts/ensure-paddle-checkout-domain.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOMAIN = "sabbath-cue-two.vercel.app";

function readApiKey() {
  const candidates = [
    process.env.PADDLE_API_KEY?.trim(),
    process.env.PADDLE_SANDBOX_API_KEY?.trim(),
    process.env.PADDLE_LIVE_API_KEY?.trim(),
  ].filter(Boolean);

  for (const key of candidates) {
    if (/^pdl_(sdbx|live)_apikey_/.test(key)) return key;
  }

  const localPath = join(repoRoot, ".paddle-api-key.local");
  if (existsSync(localPath)) {
    const line = readFileSync(localPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    if (line && /^pdl_(sdbx|live)_apikey_/.test(line)) return line;
  }

  return null;
}

function apiBase(apiKey) {
  return apiKey.startsWith("pdl_live_")
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

async function listCheckoutDomain(apiKey, domain) {
  const url = new URL("/checkout-domains", apiBase(apiKey));
  url.searchParams.set("domain", domain);
  url.searchParams.set("per_page", "10");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body?.error?.detail ?? `Paddle API ${response.status} listing checkout domains`
    );
  }

  return body.data ?? [];
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error(
      "Missing Paddle API key. Set PADDLE_API_KEY or create .paddle-api-key.local"
    );
    process.exit(1);
  }

  const env = apiKey.startsWith("pdl_live_") ? "production" : "sandbox";
  console.log(`Checking ${env} checkout domain: ${DOMAIN}`);

  const rows = await listCheckoutDomain(apiKey, DOMAIN);
  const match = rows.find((row) => row.domain === DOMAIN);

  if (!match) {
    console.error(`\nDomain not found in Paddle ${env}.`);
    console.error(
      "Add it in Paddle → Checkout → Website approval (or Checkout settings → Domains)."
    );
    console.error(`  Domain: ${DOMAIN}`);
    process.exit(1);
  }

  console.log(`Status: ${match.status} (id: ${match.id})`);

  if (match.status !== "approved") {
    console.error(
      `\nDomain is not approved yet. Live checkout will fail until status is "approved".`
    );
    process.exit(1);
  }

  console.log("\nCheckout domain is approved.");
  console.log(`Default payment link: https://${DOMAIN}/pay/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
