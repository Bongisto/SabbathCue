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
  yearlySavingsDisplay: "R400",
  twelveMonthlyTotalDisplay: "R2,400",
  trialDays: 14,
} as const;

export function catalogPricingSummaryLine(): string {
  const { monthly, yearly } = CATALOG_PRICING;
  return `${monthly.display}/mo or ${yearly.display}/yr`;
}
