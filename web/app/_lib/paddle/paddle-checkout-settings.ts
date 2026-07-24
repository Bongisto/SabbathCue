import type { Environments } from "@paddle/paddle-js";
import { buildCheckoutSuccessUrl } from "./checkout-success-url";
import type { PaddlePublicConfig } from "./config";
import { paddleJsEnvironment } from "./config";
import { buildPwCustomerOption } from "./pw-customer";

export function buildOverlayCheckoutSettings(config: PaddlePublicConfig) {
  return {
    displayMode: "overlay" as const,
    variant: "one-page" as const,
    successUrl: buildCheckoutSuccessUrl(config),
  };
}

export type PaddleInitializeCheckoutOptions = {
  token: string;
  environment: Environments;
  pwCustomer?: PaddleInitializePwCustomer;
  checkout: {
    settings: ReturnType<typeof buildOverlayCheckoutSettings>;
  };
  eventCallback?: (event: unknown) => void;
};

type PaddleInitializePwCustomer = {
  id: string;
};

export function buildPaddleInitializeOptions(
  config: PaddlePublicConfig,
  eventCallback?: (event: unknown) => void,
  options: { paddleCustomerId?: string | null } = {}
): PaddleInitializeCheckoutOptions {
  return {
    token: config.clientToken,
    environment: paddleJsEnvironment(config),
    ...buildPwCustomerOption(options.paddleCustomerId),
    checkout: {
      settings: buildOverlayCheckoutSettings(config),
    },
    ...(eventCallback ? { eventCallback } : {}),
  };
}
