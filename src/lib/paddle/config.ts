export type PaddleEnvironment = "sandbox" | "production"

export type BillingInterval = "month" | "year"

export interface PaddleCatalogConfig {
  clientToken: string
  environment: PaddleEnvironment
  priceId: {
    month: string
    year: string | null
  }
}

function readMonthPriceId(): string | undefined {
  const fromMonth = import.meta.env.VITE_PADDLE_PRICE_PRO_MONTH?.trim()
  if (fromMonth) return fromMonth
  return import.meta.env.VITE_PADDLE_PRICE_ID?.trim()
}

function readYearPriceId(): string | undefined {
  const priceId = import.meta.env.VITE_PADDLE_PRICE_PRO_YEAR?.trim()
  return priceId || undefined
}

export function getPaddleCatalogConfig(): PaddleCatalogConfig | null {
  const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim()
  const environment = import.meta.env.VITE_PADDLE_ENV?.trim() as
    | PaddleEnvironment
    | undefined
  const month = readMonthPriceId()
  const year = readYearPriceId() ?? null

  if (!clientToken || !environment || !month) return null
  if (environment !== "sandbox" && environment !== "production") return null

  return {
    clientToken,
    environment,
    priceId: { month, year },
  }
}

export function priceIdForInterval(
  config: PaddleCatalogConfig,
  interval: BillingInterval
): string | null {
  if (interval === "month") return config.priceId.month
  return config.priceId.year
}

export function isYearlyCheckoutAvailable(): boolean {
  const config = getPaddleCatalogConfig()
  return Boolean(config?.priceId.year)
}

export function isPaddleCheckoutConfigured(): boolean {
  return getPaddleCatalogConfig() !== null
}
