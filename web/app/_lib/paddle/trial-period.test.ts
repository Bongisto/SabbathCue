import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXPECTED_PADDLE_TRIAL,
  hasExpectedPaddleTrialPeriod,
  PADDLE_TRIAL_DAYS,
  SABBATHCUE_ACCESS_PRICE_IDS,
} from "./trial-period";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const paddleKeyPath = join(repoRoot, ".paddle-api-key.local");

function readSandboxApiKey(): string | null {
  const fromEnv =
    process.env.PADDLE_SANDBOX_API_KEY?.trim() ||
    process.env.PADDLE_API_KEY?.trim();
  if (fromEnv?.startsWith("pdl_sdbx_")) return fromEnv;
  if (!existsSync(paddleKeyPath)) return null;
  const fromFile = readFileSync(paddleKeyPath, "utf8").trim();
  return fromFile.startsWith("pdl_sdbx_") ? fromFile : null;
}

async function fetchSandboxPrice(priceId: string) {
  const apiKey = readSandboxApiKey();
  if (!apiKey) return null;

  const response = await fetch(
    `https://sandbox-api.paddle.com/prices/${priceId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Paddle prices.get failed for ${priceId}: ${response.status} ${await response.text()}`
    );
  }

  const body = (await response.json()) as {
    data?: { id: string; trial_period?: unknown };
  };
  return body.data ?? null;
}

describe("Paddle trial period contract", () => {
  it("expects a 14-day trial with payment method required", () => {
    expect(PADDLE_TRIAL_DAYS).toBe(14);
    expect(EXPECTED_PADDLE_TRIAL).toEqual({
      interval: "day",
      frequency: 14,
      requires_payment_method: true,
    });
  });

  it("matches configured Access sandbox price ids", () => {
    expect(SABBATHCUE_ACCESS_PRICE_IDS.month).toMatch(/^pri_/);
    expect(SABBATHCUE_ACCESS_PRICE_IDS.year).toMatch(/^pri_/);
  });

  it("accepts a valid trial period shape", () => {
    expect(hasExpectedPaddleTrialPeriod(EXPECTED_PADDLE_TRIAL)).toBe(true);
  });

  it("rejects missing or partial trial periods", () => {
    expect(hasExpectedPaddleTrialPeriod(null)).toBe(false);
    expect(hasExpectedPaddleTrialPeriod(undefined)).toBe(false);
    expect(
      hasExpectedPaddleTrialPeriod({ interval: "day", frequency: 7 })
    ).toBe(false);
    expect(
      hasExpectedPaddleTrialPeriod({
        interval: "day",
        frequency: 14,
        requires_payment_method: false,
      })
    ).toBe(false);
  });
});

describe("Paddle sandbox Access prices (live API)", () => {
  const savedMonth = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH;
  const savedYear = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR;

  afterEach(() => {
    if (savedMonth === undefined) {
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH;
    } else {
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH = savedMonth;
    }
    if (savedYear === undefined) {
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR;
    } else {
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR = savedYear;
    }
  });

  it("monthly and yearly Access prices have a 14-day trial in sandbox", async () => {
    const apiKey = readSandboxApiKey();
    if (!apiKey) {
      console.warn(
        "Skipping live Paddle trial check — set PADDLE_API_KEY or .paddle-api-key.local"
      );
      return;
    }

    const monthId =
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH?.trim() ||
      SABBATHCUE_ACCESS_PRICE_IDS.month;
    const yearId =
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR?.trim() ||
      SABBATHCUE_ACCESS_PRICE_IDS.year;

    const [monthly, yearly] = await Promise.all([
      fetchSandboxPrice(monthId),
      fetchSandboxPrice(yearId),
    ]);

    expect(monthly?.id).toBe(monthId);
    expect(yearly?.id).toBe(yearId);
    expect(
      hasExpectedPaddleTrialPeriod(
        monthly?.trial_period as Parameters<
          typeof hasExpectedPaddleTrialPeriod
        >[0]
      )
    ).toBe(true);
    expect(
      hasExpectedPaddleTrialPeriod(
        yearly?.trial_period as Parameters<
          typeof hasExpectedPaddleTrialPeriod
        >[0]
      )
    ).toBe(true);
  }, 20000);
});
