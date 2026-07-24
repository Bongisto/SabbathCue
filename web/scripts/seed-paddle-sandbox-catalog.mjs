/**
 * One-time sandbox catalog setup for SabbathCue Pro pricing.
 *
 * Requires PADDLE_API_KEY (or PADDLE_SANDBOX_API_KEY) with product.write,
 * price.write, and client_token.write scopes.
 *
 * Usage (from repo root, PowerShell):
 *   $env:PADDLE_API_KEY="pdl_sdbx_apikey_..."
 *   node web/scripts/seed-paddle-sandbox-catalog.mjs
 *
 * Writes web/.env.local (merge-safe) and prints the same values.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envLocalPath = join(repoRoot, "web/.env.local");
const keyFilePath = join(repoRoot, ".paddle-api-key.local");

function readApiKeyFromFile() {
  if (!existsSync(keyFilePath)) return "";
  return readFileSync(keyFilePath, "utf8").trim();
}

/** Paddle API keys are 69 chars with exactly five underscores. */
const PADDLE_API_KEY_RE =
  /^pdl_(live|sdbx)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/;

function pickApiKey() {
  const candidates = [
    process.env.PADDLE_SANDBOX_API_KEY?.trim(),
    process.env.PADDLE_API_KEY?.trim(),
    readApiKeyFromFile(),
  ].filter(Boolean);

  for (const key of candidates) {
    if (PADDLE_API_KEY_RE.test(key)) return key;
  }

  return candidates[0] ?? "";
}

const apiKey = pickApiKey();

function explainBadApiKey(key) {
  const underscores = (key.match(/_/g) ?? []).length;
  console.error("\nYour PADDLE_API_KEY does not look like a full Paddle API key.");
  console.error(`  Length: ${key.length} (expected 69)`);
  console.error(`  Underscores: ${underscores} (expected 5)`);
  console.error("\nA valid sandbox key looks like:");
  console.error("  pdl_sdbx_apikey_<copy-the-full-secret-from-Paddle>");
  console.error("\nGet the FULL key from:");
  console.error("  https://sandbox-vendors.paddle.com/authentication-v2");
  console.error("  → Create API key → copy the entire secret (shown once only).");
  console.error("\nEasiest on Windows (no quoting):");
  console.error("  1. Put your full key in .paddle-api-key.local (repo root, one line)");
  console.error("  2. bun run paddle:setup:ps1");
  console.error("\nIf $env:PADDLE_API_KEY was set earlier with a partial key, clear it:");
  console.error("  Remove-Item Env:PADDLE_API_KEY");
}

if (!apiKey) {
  console.error(
    "Missing Paddle API key.\n\nOption A — create .paddle-api-key.local in the repo root (one line, your pdl_sdbx_apikey_... key), then run:\n  node web/scripts/seed-paddle-sandbox-catalog.mjs\n\nOption B — PowerShell with quotes:\n  $env:PADDLE_API_KEY=\"pdl_sdbx_apikey_01...\"\n  node web/scripts/seed-paddle-sandbox-catalog.mjs\n\nCreate keys at https://sandbox-vendors.paddle.com/authentication-v2"
  );
  process.exit(1);
}

if (!apiKey.startsWith("pdl_sdbx_")) {
  console.error("Refusing to run: API key must be a sandbox key (pdl_sdbx_...).");
  process.exit(1);
}

if (!PADDLE_API_KEY_RE.test(apiKey)) {
  explainBadApiKey(apiKey);
  process.exit(1);
}

const paddle = new Paddle(apiKey, { environment: Environment.sandbox });

const PRODUCT_NAME = "SabbathCue Pro";
const MONTHLY_DESC = "Pro monthly ZAR";
const YEARLY_DESC = "Pro yearly ZAR";
const TOKEN_NAME = "SabbathCue Web Sandbox";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function mergeSupabaseFromRoot(existing) {
  const root = parseEnvFile(join(repoRoot, ".env"));
  return {
    ...existing,
    NEXT_PUBLIC_SUPABASE_URL:
      existing.NEXT_PUBLIC_SUPABASE_URL || root.VITE_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      existing.NEXT_PUBLIC_SUPABASE_ANON_KEY || root.VITE_SUPABASE_ANON_KEY || "",
  };
}

function writeWebEnvLocal(paddleVars) {
  const existing = mergeSupabaseFromRoot(parseEnvFile(envLocalPath));
  const merged = {
    ...existing,
    ...paddleVars,
  };

  const lines = [
    "# Generated / updated by web/scripts/seed-paddle-sandbox-catalog.mjs",
    "",
    "# Supabase (signed-in email prefill at checkout)",
    `NEXT_PUBLIC_SUPABASE_URL="${merged.NEXT_PUBLIC_SUPABASE_URL ?? ""}"`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY="${merged.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}"`,
    "",
    "# Paddle sandbox checkout",
    `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="${merged.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ""}"`,
    `NEXT_PUBLIC_PADDLE_ENV="${merged.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox"}"`,
    `NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH="${merged.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH ?? ""}"`,
    `NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR="${merged.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR ?? ""}"`,
    `NEXT_PUBLIC_BASE_PATH="${merged.NEXT_PUBLIC_BASE_PATH ?? "/SabbathCue"}"`,
    `NEXT_PUBLIC_SITE_ORIGIN="${merged.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3029"}"`,
    "",
  ];

  writeFileSync(envLocalPath, lines.join("\n"), "utf8");
  console.log(`\nWrote ${envLocalPath}`);
}

async function findProductByName(name) {
  for await (const product of paddle.products.list({ status: "active" })) {
    if (product.name === name) return product;
  }
  return null;
}

async function findPrice(productId, description) {
  for await (const price of paddle.prices.list({
    productId: [productId],
    status: "active",
  })) {
    if (price.description === description) return price;
  }
  return null;
}

async function createClientTokenViaApi(name) {
  const response = await fetch("https://sandbox-api.paddle.com/client-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: "SabbathCue marketing site pricing and checkout",
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      body?.error?.detail ??
        `Failed to create client token (${response.status})`
    );
  }

  return body.data;
}

async function seed() {
  let product = await findProductByName(PRODUCT_NAME);
  if (!product) {
    product = await paddle.products.create({
      name: PRODUCT_NAME,
      taxCategory: "saas",
      description:
        "Full SabbathCue access with a 14-day trial on monthly billing.",
    });
    console.log("Created product:", product.id);
  } else {
    console.log("Reusing product:", product.id);
  }

  let monthly = await findPrice(product.id, MONTHLY_DESC);
  if (!monthly) {
    monthly = await paddle.prices.create({
      productId: product.id,
      description: MONTHLY_DESC,
      unitPrice: { amount: "20000", currencyCode: "ZAR" },
      billingCycle: { interval: "month", frequency: 1 },
      trialPeriod: { interval: "day", frequency: 14 },
    });
    console.log("Created monthly price:", monthly.id, "(200 ZAR / month, 14-day trial)");
  } else {
    console.log("Reusing monthly price:", monthly.id);
  }

  let yearly = await findPrice(product.id, YEARLY_DESC);
  if (!yearly) {
    yearly = await paddle.prices.create({
      productId: product.id,
      description: YEARLY_DESC,
      unitPrice: { amount: "200000", currencyCode: "ZAR" },
      billingCycle: { interval: "year", frequency: 1 },
      trialPeriod: { interval: "day", frequency: 14 },
    });
    console.log("Created yearly price:", yearly.id, "(2000 ZAR / year, 14-day trial)");
  } else {
    console.log("Reusing yearly price:", yearly.id);
  }

  const token = await createClientTokenViaApi(
    `${TOKEN_NAME} ${new Date().toISOString().slice(0, 10)}`
  );
  console.log("Created client token:", token.id);

  if (!token.token?.startsWith("test_")) {
    throw new Error(
      "Paddle did not return a client token secret. Create one in Dashboard → Developer tools → Client-side tokens."
    );
  }

  const paddleVars = {
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: token.token,
    NEXT_PUBLIC_PADDLE_ENV: "sandbox",
    NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH: monthly.id,
    NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR: yearly.id,
    NEXT_PUBLIC_BASE_PATH: "/SabbathCue",
    NEXT_PUBLIC_SITE_ORIGIN: "http://localhost:3029",
  };

  writeWebEnvLocal(paddleVars);

  console.log("\n--- Paddle env (also in web/.env.local) ---\n");
  console.log(`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="${token.token}"`);
  console.log(`NEXT_PUBLIC_PADDLE_ENV="sandbox"`);
  console.log(`NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH="${monthly.id}"`);
  console.log(`NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR="${yearly.id}"`);
  console.log("\n--- Dashboard reminder ---");
  console.log(
    "Set Paddle → Checkout → Checkout settings → Default payment link to:"
  );
  console.log("  http://localhost:3029/SabbathCue/pay/");
  console.log(
    "(Production: https://bongisto.github.io/SabbathCue/pay/ or your custom domain.)"
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
