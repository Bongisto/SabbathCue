/**
 * Public ZAR list prices for SabbathCue Access — must match Paddle catalog
 * (sandbox + live) unit_price_overrides for ZA.
 */
export const CATALOG_PRICING = {
  monthly: {
    display: "R200",
    periodLabel: "month",
    paddleAmountZar: "20000",
  },
  yearly: {
    display: "R2,000",
    periodLabel: "year",
    paddleAmountZar: "200000",
  },
  /** 12 × monthly − yearly (two months free at annual). */
  yearlySavingsDisplay: "R400",
  twelveMonthlyTotalDisplay: "R2,400",
  trialDays: 14,
} as const;

export function catalogPricingSummaryLine(): string {
  const { monthly, yearly } = CATALOG_PRICING;
  return `${monthly.display}/mo or ${yearly.display}/yr`;
}
