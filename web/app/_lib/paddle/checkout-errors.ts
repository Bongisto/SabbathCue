export const PADDLE_CHECKOUT_SETUP_HINT =
  "In Paddle sandbox: Checkout → Checkout settings → set Default payment link to http://localhost:3029/SabbathCue/pay/ (or your deployed /pay/ URL).";

export type PaddleCheckoutEvent = {
  name?: string;
  type?: string;
  data?: unknown;
};

/** User-facing message for Paddle.js checkout.error events, or null if unrelated. */
export function describePaddleCheckoutError(
  event: PaddleCheckoutEvent
): string | null {
  if (event.name !== "checkout.error") return null;
  return `Checkout could not open. ${PADDLE_CHECKOUT_SETUP_HINT}`;
}
