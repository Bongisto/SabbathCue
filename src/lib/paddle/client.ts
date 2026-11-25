import {
  initializePaddle,
  type Paddle,
  type Environments,
} from "@paddle/paddle-js"
import { getPaddleCatalogConfig } from "@/lib/paddle/config"
import { buildPwCustomerOption } from "@/lib/paddle/pw-customer"

let paddlePromise: Promise<Paddle | undefined> | null = null
let paddleCustomerId: string | null = null
const invalidationListeners = new Set<() => void>()

export function onPaddleInstanceInvalidated(listener: () => void): () => void {
  invalidationListeners.add(listener)
  return () => {
    invalidationListeners.delete(listener)
  }
}

function invalidatePaddleInstance(): void {
  paddlePromise = null
  for (const listener of [...invalidationListeners]) {
    listener()
  }
}

export function setPaddleCustomerIdForInit(customerId: string | null): void {
  const normalized = customerId?.trim() || null
  if (normalized === paddleCustomerId) return
  paddleCustomerId = normalized
  invalidatePaddleInstance()
}

export function getPaddleInstance(): Promise<Paddle | undefined> {
  if (paddlePromise) return paddlePromise

  const config = getPaddleCatalogConfig()
  if (!config) {
    return Promise.resolve(undefined)
  }

  const pending = initializePaddle({
    token: config.clientToken,
    environment: config.environment as Environments,
    ...buildPwCustomerOption(paddleCustomerId),
    checkout: {
      settings: {
        displayMode: "overlay",
        variant: "one-page",
      },
    },
  })
    .then((instance) => {
      const resolved = instance ?? undefined
      if (!resolved && paddlePromise === pending) {
        paddlePromise = null
      }
      return resolved
    })
    .catch((error: unknown) => {
      if (paddlePromise === pending) {
        paddlePromise = null
      }
      throw error
    })

  paddlePromise = pending
  return pending
}

export function resetPaddleInstanceForTests(): void {
  paddleCustomerId = null
  invalidatePaddleInstance()
}
