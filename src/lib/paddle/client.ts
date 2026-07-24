import {
  initializePaddle,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js"
import { getPaddleCatalogConfig } from "@/lib/paddle/config"
import { buildPwCustomerOption } from "@/lib/paddle/pw-customer"

let paddlePromise: Promise<Paddle | undefined> | null = null
let paddleCustomerId: string | null = null

export function setPaddleCustomerIdForInit(customerId: string | null): void {
  paddleCustomerId = customerId?.trim() || null
  paddlePromise = null
}

export function getPaddleInstance(): Promise<Paddle | undefined> {
  if (paddlePromise) return paddlePromise

  const config = getPaddleCatalogConfig()
  if (!config) {
    paddlePromise = Promise.resolve(undefined)
    return paddlePromise
  }

  paddlePromise = initializePaddle({
    token: config.clientToken,
    environment: config.environment as Environments,
    ...buildPwCustomerOption(paddleCustomerId),
    checkout: {
      settings: {
        displayMode: "overlay",
        variant: "one-page",
      },
    },
  }).then((instance) => instance ?? undefined)

  return paddlePromise
}

export function resetPaddleInstanceForTests(): void {
  paddlePromise = null
  paddleCustomerId = null
}
