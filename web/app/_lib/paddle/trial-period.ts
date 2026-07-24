/** SabbathCue Access prices use a 14-day Paddle trial before the first charge. */
export const PADDLE_TRIAL_DAYS = 14;

export interface PaddleTrialPeriod {
  interval?: string;
  frequency?: number;
  requires_payment_method?: boolean;
}

export const EXPECTED_PADDLE_TRIAL: Required<
  Pick<PaddleTrialPeriod, "interval" | "frequency" | "requires_payment_method">
> = {
  interval: "day",
  frequency: PADDLE_TRIAL_DAYS,
  requires_payment_method: true,
};

/** True when the price has a 14-day trial with payment method collected at checkout. */
export function hasExpectedPaddleTrialPeriod(
  trial: PaddleTrialPeriod | null | undefined
): boolean {
  if (!trial) return false;
  return (
    trial.interval === EXPECTED_PADDLE_TRIAL.interval &&
    trial.frequency === EXPECTED_PADDLE_TRIAL.frequency &&
    trial.requires_payment_method === EXPECTED_PADDLE_TRIAL.requires_payment_method
  );
}

/** Price IDs for trial verification scripts — prefer env, sandbox fallback for dev. */
export function readSabbathCueAccessPriceIds(): {
  month: string;
  year: string;
} {
  return {
    month:
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH?.trim() ||
      "pri_01ky9g8d6v1f554xwrf56534st",
    year:
      process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR?.trim() ||
      "pri_01ky9jdv4c5nbzahqf3yh5kdms",
  };
}

/** @deprecated Use readSabbathCueAccessPriceIds() — kept for existing imports. */
export const SABBATHCUE_ACCESS_PRICE_IDS = readSabbathCueAccessPriceIds();
