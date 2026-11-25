// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verificationState: {
  status: "error" | "required"
  error: string | null
  errorCode: "trial_expired"
  verifiedEmail: string | null
  verifiedUserId: string | null
  signIn: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
} = {
  status: "error",
  error: "Your access has ended.",
  errorCode: "trial_expired",
  verifiedEmail: "pastor@church.org",
  verifiedUserId: "user-123",
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
}

vi.mock("@/stores/verification-store", () => {
  const useVerificationStore = (
    selector: (state: typeof verificationState) => unknown
  ) => selector(verificationState)
  useVerificationStore.getState = () => verificationState
  return { useVerificationStore }
})

vi.mock("@/stores/accent-theme-store", () => ({
  accentThemeClassName: () => "",
  useAccentThemeStore: (selector: (state: { theme: string }) => unknown) =>
    selector({ theme: "amber" }),
}))

vi.mock("@/stores/color-mode-store", () => ({
  darkSurfaceClassName: () => "",
  useColorModeStore: (selector: (state: { darkSurface: boolean }) => unknown) =>
    selector({ darkSurface: false }),
}))

vi.mock("@/lib/paddle/config", () => ({
  isPaddleCheckoutConfigured: () => true,
}))

vi.mock("@/components/billing/PaddleSubscribeButton", () => ({
  PaddleSubscribeButton: ({
    label,
    email,
    userId,
  }: {
    label?: string
    email: string
    userId: string
  }) => (
    <button
      type="button"
      data-testid="paddle-subscribe-button"
      data-email={email}
      data-user-id={userId}
    >
      {label ?? "Subscribe with Paddle"}
    </button>
  ),
}))

vi.mock("@/components/billing/EftPaymentOptions", () => ({
  EftPaymentOptions: ({ accountEmail }: { accountEmail?: string | null }) => (
    <div
      data-testid="eft-payment-options"
      data-email={accountEmail ?? ""}
    >
      Pay by EFT panel
    </div>
  ),
}))

import { VerificationScreen } from "./VerificationScreen"

describe("VerificationScreen trial expired", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(async () => {
    verificationState.status = "error"
    verificationState.errorCode = "trial_expired"
    verificationState.verifiedEmail = "pastor@church.org"
    verificationState.verifiedUserId = "user-123"
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(<VerificationScreen />)
    })
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
  })

  it("shows Paddle checkout and Pay by EFT together with account email and user id", () => {
    expect(container?.textContent).toContain("Access ended")
    const paddleButton = container?.querySelector(
      '[data-testid="paddle-subscribe-button"]'
    )
    expect(paddleButton?.textContent).toContain("Subscribe with Paddle")
    expect(paddleButton?.getAttribute("data-email")).toBe("pastor@church.org")
    expect(paddleButton?.getAttribute("data-user-id")).toBe("user-123")
    const eftPanel = container?.querySelector(
      '[data-testid="eft-payment-options"]'
    )
    expect(eftPanel).toBeTruthy()
    expect(eftPanel?.getAttribute("data-email")).toBe("pastor@church.org")
    expect(container?.textContent).toContain("or")
  })

  it("falls back to entered email for EFT when verifiedEmail is absent", async () => {
    verificationState.status = "required"
    verificationState.errorCode = "trial_expired"
    verificationState.verifiedEmail = null
    verificationState.verifiedUserId = null

    await act(async () => {
      root?.render(<VerificationScreen />)
    })

    const emailInput = container?.querySelector<HTMLInputElement>('input[type="email"]')
    expect(emailInput).toBeTruthy()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set
      setter?.call(emailInput, "  typed@church.org  ")
      emailInput?.dispatchEvent(new Event("input", { bubbles: true }))
    })

    verificationState.status = "error"
    await act(async () => {
      root?.render(<VerificationScreen />)
    })

    const eftPanel = container?.querySelector(
      '[data-testid="eft-payment-options"]'
    )
    expect(eftPanel?.getAttribute("data-email")).toBe("typed@church.org")
  })
})
