import { afterEach, describe, expect, it, vi } from "vitest"

describe("getPaddleCatalogConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("reads month from VITE_PADDLE_PRICE_PRO_MONTH and year from env", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test_token")
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_MONTH", "pri_month")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_YEAR", "pri_year")

    const { getPaddleCatalogConfig } = await import("@/lib/paddle/config")
    expect(getPaddleCatalogConfig()).toEqual({
      clientToken: "test_token",
      environment: "sandbox",
      priceId: { month: "pri_month", year: "pri_year" },
    })
  })

  it("falls back to VITE_PADDLE_PRICE_ID for monthly", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test_token")
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_MONTH", "")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_YEAR", "")
    vi.stubEnv("VITE_PADDLE_PRICE_ID", "pri_legacy_month")

    const { getPaddleCatalogConfig } = await import("@/lib/paddle/config")
    expect(getPaddleCatalogConfig()?.priceId.month).toBe("pri_legacy_month")
    expect(getPaddleCatalogConfig()?.priceId.year).toBeNull()
  })

  it("reports yearly availability only when year price is configured", async () => {
    vi.stubEnv("VITE_PADDLE_CLIENT_TOKEN", "test_token")
    vi.stubEnv("VITE_PADDLE_ENV", "sandbox")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_MONTH", "")
    vi.stubEnv("VITE_PADDLE_PRICE_PRO_YEAR", "")
    vi.stubEnv("VITE_PADDLE_PRICE_ID", "pri_month")

    const { isYearlyCheckoutAvailable } = await import("@/lib/paddle/config")
    expect(isYearlyCheckoutAvailable()).toBe(false)

    vi.stubEnv("VITE_PADDLE_PRICE_PRO_YEAR", "pri_year")
    expect(isYearlyCheckoutAvailable()).toBe(true)
  })
})

describe("priceIdForInterval", () => {
  it("returns null for yearly when not configured", async () => {
    const { priceIdForInterval } = await import("@/lib/paddle/config")
    expect(
      priceIdForInterval(
        {
          clientToken: "test_token",
          environment: "sandbox",
          priceId: { month: "pri_month", year: null },
        },
        "year"
      )
    ).toBeNull()
  })
})
