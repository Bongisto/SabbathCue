/**
 * Ensures SabbathCue Access sandbox prices have a 14-day Paddle trial.
 * Idempotent: safe to re-run after catalog changes.
 *
 * Usage:
 *   node web/scripts/ensure-paddle-access-trial.mjs
 *
 * Reads PADDLE_API_KEY, PADDLE_SANDBOX_API_KEY, or .paddle-api-key.local.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const keyFilePath = join(repoRoot, ".paddle-api-key.local");

const EXPECTED_TRIAL = {
  interval: "day",
  frequency: 14,
  requires_payment_method: true,
};

const DEFAULT_PRICE_IDS = {
  month: "pri_01ky9g8d6v1f554xwrf56534st",
  year: "pri_01ky9jdv4c5nbzahqf3yh5kdms",
};

function readApiKey() {
  const candidates = [
    process.env.PADDLE_SANDBOX_API_KEY?.trim(),
    process.env.PADDLE_API_KEY?.trim(),
    existsSync(keyFilePath) ? readFileSync(keyFilePath, "utf8").trim() : "",
  ].filter(Boolean);

  for (const key of candidates) {
    if (key.startsWith("pdl_sdbx_")) return key;
  }
  return null;
}

function trialMatches(actual) {
  if (!actual) return false;
  return (
    actual.interval === EXPECTED_TRIAL.interval &&
    actual.frequency === EXPECTED_TRIAL.frequency &&
    actual.requires_payment_method === EXPECTED_TRIAL.requires_payment_method
  );
}

async function paddleFetch(apiKey, path, options = {}) {
  const response = await fetch(`https://sandbox-api.paddle.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body?.error?.detail ?? `${path} failed (${response.status})`
    );
  }
  return body.data;
}

async function ensureTrial(apiKey, priceId, label) {
  let price = await paddleFetch(apiKey, `/prices/${priceId}`);

  if (!trialMatches(price.trial_period)) {
    console.log(`Updating ${label} (${priceId}) with 14-day trial…`);
    price = await paddleFetch(apiKey, `/prices/${priceId}`, {
      method: "PATCH",
      body: JSON.stringify({ trial_period: EXPECTED_TRIAL }),
    });
  } else {
    console.log(`${label} (${priceId}) already has 14-day trial.`);
  }

  if (!trialMatches(price.trial_period)) {
    throw new Error(
      `${label} (${priceId}) trial_period mismatch after update: ${JSON.stringify(price.trial_period)}`
    );
  }

  return price;
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error(
      "Missing sandbox Paddle API key. Set PADDLE_API_KEY or create .paddle-api-key.local."
    );
    process.exit(1);
  }

  const monthId =
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH?.trim() ||
    DEFAULT_PRICE_IDS.month;
  const yearId =
    process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR?.trim() ||
    DEFAULT_PRICE_IDS.year;

  await ensureTrial(apiKey, monthId, "Monthly Access");
  await ensureTrial(apiKey, yearId, "Yearly Access");

  console.log("\nVerified: both Access prices defer billing for 14 days.");
  console.log("Checkout collects a payment method; first charge is after trial.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
