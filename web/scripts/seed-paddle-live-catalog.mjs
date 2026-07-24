/**
 * Idempotent live catalog setup for SabbathCue Access (mirrors sandbox).
 *
 * Requires PADDLE_LIVE_API_KEY or a live key in .paddle-api-key.local.
 * Does NOT delete or recreate existing live entities.
 *
 * Usage (PowerShell):
 *   $env:PADDLE_LIVE_API_KEY="pdl_live_apikey_..."
 *   node web/scripts/seed-paddle-live-catalog.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const keyFilePath = join(repoRoot, ".paddle-api-key.local");
const liveEnvExamplePath = join(repoRoot, ".env.live.example");
const liveEnvLocalPath = join(repoRoot, ".env.live.local");

const PRODUCT_NAME = "SabbathCue Access";
const MONTHLY_DESC = "SabbathCue Access monthly USD";
const YEARLY_DESC = "SabbathCue Access yearly USD";
const TOKEN_NAME = "SabbathCue Web Live";
const CHECKOUT_DOMAIN = "sabbath-cue-two.vercel.app";
const WEBHOOK_URL =
  "https://pdpigafulitwdzbwzelb.supabase.co/functions/v1/paddle-webhook";

const WEBHOOK_EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "customer.created",
  "customer.updated",
  "transaction.completed",
];

const EXPECTED_TRIAL = {
  interval: "day",
  frequency: 14,
  requires_payment_method: true,
};

const PADDLE_API_KEY_RE =
  /^pdl_(live|sdbx)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/;

function readApiKey() {
  const candidates = [
    process.env.PADDLE_LIVE_API_KEY?.trim(),
    process.env.PADDLE_API_KEY?.trim(),
    existsSync(keyFilePath) ? readFileSync(keyFilePath, "utf8").trim() : "",
  ].filter(Boolean);

  for (const key of candidates) {
    if (key.startsWith("pdl_live_") && PADDLE_API_KEY_RE.test(key)) return key;
  }
  return null;
}

function apiBase() {
  return "https://api.paddle.com";
}

async function paddleFetch(apiKey, path, options = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
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

async function listAll(apiKey, resource) {
  const rows = [];
  let after;
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${apiBase()}/${resource}`);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("status", "active");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body?.error?.detail ?? `list ${resource} failed (${response.status})`
      );
    }

    const key = resource.replace(/-/g, "_");
    const batch = body.data ?? body[key] ?? [];
    rows.push(...batch);
    if (!body.meta?.pagination?.has_more) break;
    after = batch.at(-1)?.id;
  }
  return rows;
}

async function findProductByName(apiKey, name) {
  const products = await listAll(apiKey, "products");
  return products.find((product) => product.name === name) ?? null;
}

async function findPrice(apiKey, productId, description) {
  const prices = await listAll(apiKey, "prices");
  return (
    prices.find(
      (price) =>
        price.product_id === productId && price.description === description
    ) ?? null
  );
}

async function ensureProduct(apiKey) {
  let product = await findProductByName(apiKey, PRODUCT_NAME);
  if (product) {
    console.log("Reusing live product:", product.id, product.name);
    return product;
  }

  product = await paddleFetch(apiKey, "/products", {
    method: "POST",
    body: JSON.stringify({
      name: PRODUCT_NAME,
      tax_category: "saas",
      description:
        "Full SabbathCue access with a 14-day trial on monthly billing.",
    }),
  });
  console.log("Created live product:", product.id);
  return product;
}

async function ensureMonthlyPrice(apiKey, productId) {
  let price = await findPrice(apiKey, productId, MONTHLY_DESC);
  if (price) {
    console.log("Reusing live monthly price:", price.id);
    return price;
  }

  price = await paddleFetch(apiKey, "/prices", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      description: MONTHLY_DESC,
      unit_price: { amount: "1400", currency_code: "USD" },
      unit_price_overrides: [
        {
          country_codes: ["ZA"],
          unit_price: { amount: "20000", currency_code: "ZAR" },
        },
      ],
      billing_cycle: { interval: "month", frequency: 1 },
      trial_period: EXPECTED_TRIAL,
    }),
  });
  console.log("Created live monthly price:", price.id);
  return price;
}

async function ensureYearlyPrice(apiKey, productId) {
  let price = await findPrice(apiKey, productId, YEARLY_DESC);
  if (price) {
    console.log("Reusing live yearly price:", price.id);
    return price;
  }

  price = await paddleFetch(apiKey, "/prices", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      description: YEARLY_DESC,
      unit_price: { amount: "14000", currency_code: "USD" },
      unit_price_overrides: [
        {
          country_codes: ["ZA"],
          unit_price: { amount: "200000", currency_code: "ZAR" },
        },
      ],
      billing_cycle: { interval: "year", frequency: 1 },
      trial_period: EXPECTED_TRIAL,
    }),
  });
  console.log("Created live yearly price:", price.id);
  return price;
}

async function ensureClientToken(apiKey) {
  const tokens = await listAll(apiKey, "client-tokens");
  const existing = tokens.find(
    (token) => token.name?.startsWith("SabbathCue Web Live") && token.status === "active"
  );
  if (existing?.token?.startsWith("live_")) {
    console.log("Reusing live client token:", existing.id);
    return existing.token;
  }
  if (existing) {
    console.log(
      "Active live client token exists but secret not returned by API — creating a new token."
    );
  }

  const created = await paddleFetch(apiKey, "/client-tokens", {
    method: "POST",
    body: JSON.stringify({
      name: `${TOKEN_NAME} ${new Date().toISOString().slice(0, 10)}`,
      description: "SabbathCue marketing site and desktop checkout (live)",
    }),
  });

  if (!created.token?.startsWith("live_")) {
    throw new Error(
      "Paddle did not return a live client token secret. Create one in Dashboard → Developer tools → Client-side tokens."
    );
  }

  console.log("Created live client token:", created.id);
  return created.token;
}

async function ensureCheckoutDomain(apiKey) {
  try {
    const domains = await listAll(apiKey, "checkout-domains");
    const match = domains.find((row) => row.domain === CHECKOUT_DOMAIN);
    if (match) {
      console.log(
        `Checkout domain ${CHECKOUT_DOMAIN}: ${match.status} (${match.id})`
      );
      return match;
    }

    const created = await paddleFetch(apiKey, "/checkout-domains", {
      method: "POST",
      body: JSON.stringify({ domain: CHECKOUT_DOMAIN }),
    });
    console.log(
      `Submitted checkout domain ${CHECKOUT_DOMAIN} for approval (${created.status})`
    );
    return created;
  } catch (error) {
    console.warn(
      `Could not list/submit checkout domain via API (${error.message}).\n` +
        `Submit manually in Paddle → Checkout → Website approval:\n` +
        `  ${CHECKOUT_DOMAIN}`
    );
    return null;
  }
}

async function ensureNotificationDestination(apiKey) {
  try {
    const settings = await listAll(apiKey, "notification-settings");
    if (settings.length > 0) {
      console.log(
        `Found ${settings.length} live notification destination(s) — not creating a new one.`
      );
      for (const row of settings) {
        console.log(`  - ${row.id}: ${row.destination}`);
      }
      return { created: false, settings };
    }

    const created = await paddleFetch(apiKey, "/notification-settings", {
      method: "POST",
      body: JSON.stringify({
        description: "SabbathCue Supabase webhook (live)",
        type: "url",
        destination: WEBHOOK_URL,
        subscribed_events: WEBHOOK_EVENTS,
        traffic_source: "platform",
      }),
    });

    console.log("\n--- NEW WEBHOOK SECRET (copy once to Supabase) ---");
    console.log(`PADDLE_NOTIFICATION_WEBHOOK_SECRET=${created.endpoint_secret_key}`);
    console.log("--- end webhook secret ---\n");

    return { created: true, settings: [created] };
  } catch (error) {
    console.warn(
      `Could not configure notification destination via API (${error.message}).\n` +
        `Create manually in Paddle → Developer tools → Notifications:\n` +
        `  URL: ${WEBHOOK_URL}\n` +
        `  Events: ${WEBHOOK_EVENTS.join(", ")}`
    );
    return { created: false, settings: [], error: error.message };
  }
}

function writeLiveEnvFiles(mapping) {
  const secretLines = [
    "# Live Paddle — generated by web/scripts/seed-paddle-live-catalog.mjs",
    "# Copy into Vercel Production env + root .env when going live.",
    "",
    "# Desktop app (.env)",
    `VITE_PADDLE_CLIENT_TOKEN="${mapping.clientToken}"`,
    'VITE_PADDLE_ENV="production"',
    `VITE_PADDLE_PRICE_PRO_MONTH="${mapping.monthlyPriceId}"`,
    `VITE_PADDLE_PRICE_PRO_YEAR="${mapping.yearlyPriceId}"`,
    "",
    "# Web / Vercel (Production)",
    `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="${mapping.clientToken}"`,
    'NEXT_PUBLIC_PADDLE_ENV="production"',
    `NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH="${mapping.monthlyPriceId}"`,
    `NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR="${mapping.yearlyPriceId}"`,
    'NEXT_PUBLIC_SITE_ORIGIN="https://sabbath-cue-two.vercel.app"',
    'NEXT_PUBLIC_BASE_PATH=""',
    "",
    "# Supabase Edge Function secrets",
    "# PADDLE_API_KEY=pdl_live_apikey_...",
    "# PADDLE_ENV=production",
    mapping.webhookSecret
      ? `# PADDLE_NOTIFICATION_WEBHOOK_SECRET=${mapping.webhookSecret}`
      : "# PADDLE_NOTIFICATION_WEBHOOK_SECRET=pdl_ntfset_...",
    "",
    "# Sandbox → live ID mapping",
    "# pro_01ky9g8d309rjvd7teg338as21 → " + mapping.productId,
    "# pri_01ky9g8d6v1f554xwrf56534st → " + mapping.monthlyPriceId,
    "# pri_01ky9jdv4c5nbzahqf3yh5kdms → " + mapping.yearlyPriceId,
    "",
  ];

  const exampleLines = secretLines.map((line) => {
    if (line.startsWith('VITE_PADDLE_CLIENT_TOKEN="live_')) {
      return 'VITE_PADDLE_CLIENT_TOKEN="live_PASTE_FROM_.env.live.local"';
    }
    if (line.startsWith('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="live_')) {
      return 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="live_PASTE_FROM_.env.live.local"';
    }
    if (line.startsWith("# PADDLE_NOTIFICATION_WEBHOOK_SECRET=pdl_ntfset_")) {
      return "# PADDLE_NOTIFICATION_WEBHOOK_SECRET=pdl_ntfset_PASTE_FROM_.env.live.local";
    }
    return line;
  });

  writeFileSync(liveEnvExamplePath, exampleLines.join("\n"), "utf8");
  writeFileSync(liveEnvLocalPath, secretLines.join("\n"), "utf8");
  console.log(`\nWrote ${liveEnvExamplePath} (safe placeholders — OK to commit)`);
  console.log(`Wrote ${liveEnvLocalPath} (gitignored — contains live secrets)`);
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error(
      "Missing live Paddle API key.\nSet PADDLE_LIVE_API_KEY or put pdl_live_apikey_... in .paddle-api-key.local"
    );
    process.exit(1);
  }

  console.log("Seeding LIVE Paddle catalog (additive only)…\n");

  const product = await ensureProduct(apiKey);
  const monthly = await ensureMonthlyPrice(apiKey, product.id);
  const yearly = await ensureYearlyPrice(apiKey, product.id);
  const clientToken = await ensureClientToken(apiKey);
  await ensureCheckoutDomain(apiKey);
  const notificationResult = await ensureNotificationDestination(apiKey);
  const settings = notificationResult.settings ?? [];
  const forWebhook = settings.filter((row) => row.destination === WEBHOOK_URL);
  const webhookSecret = notificationResult.created
    ? settings[0]?.endpoint_secret_key ?? null
    : null;

  console.log("\n--- Live catalog IDs ---");
  console.log(`Product:  ${product.id} (${PRODUCT_NAME})`);
  console.log(`Monthly:  ${monthly.id}`);
  console.log(`Yearly:   ${yearly.id}`);
  console.log(`Token:    ${clientToken.slice(0, 12)}…`);

  console.log("\n--- Notification destinations ---");
  if (settings.length === 0) {
    console.log(
      "No live notification destinations found via API.\n" +
        "Create ONE in Paddle → Developer tools → Notifications:\n" +
        `  URL: ${WEBHOOK_URL}\n` +
        `  Events: ${WEBHOOK_EVENTS.join(", ")}\n` +
        "Copy endpoint_secret_key into Supabase secret PADDLE_NOTIFICATION_WEBHOOK_SECRET.\n" +
        "Do NOT delete/recreate an existing live destination — that rotates the secret."
    );
  } else if (forWebhook.length > 0) {
    console.log(
      `Found ${forWebhook.length} destination(s) for ${WEBHOOK_URL}. Reuse existing secret; do not recreate.`
    );
  } else {
    console.log(
      "Live destinations exist but none point at your Supabase webhook URL.\n" +
        "Add a NEW destination (do not delete existing ones) or update manually in the dashboard."
    );
    for (const row of settings) {
      console.log(`  - ${row.id}: ${row.destination}`);
    }
  }

  writeLiveEnvFiles({
    productId: product.id,
    monthlyPriceId: monthly.id,
    yearlyPriceId: yearly.id,
    clientToken,
    webhookSecret,
  });

  console.log("\n--- Next steps ---");
  console.log(
    "1. Copy values from .env.live.local into Vercel Production env + root .env"
  );
  console.log(
    "2. Set Supabase secrets PADDLE_API_KEY (live), PADDLE_ENV=production, webhook secret"
  );
  console.log(
    "3. Paddle → Checkout → Checkout settings → Default payment link:"
  );
  console.log(`   https://${CHECKOUT_DOMAIN}/pay/`);
  console.log("4. Redeploy Vercel + redeploy paddle-webhook edge function");
  console.log(
    "5. Do NOT take real payments until account verification + domain approval complete"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
