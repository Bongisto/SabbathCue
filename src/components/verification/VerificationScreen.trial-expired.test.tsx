// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verificationState = {
  status: "error" as const,
  error: "Your access has ended.",
  errorCode: "trial_expired" as const,
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
  PaddleSubscribeButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Subscribe with Paddle"}</button>
  ),
}))

vi.mock("@/components/billing/EftPaymentOptions", () => ({
  EftPaymentOptions: () => (
    <div data-testid="eft-payment-options">Pay by EFT panel</div>
  ),
}))

import { VerificationScreen } from "./VerificationScreen"

describe("VerificationScreen trial expired", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(async () => {
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

  it("shows Paddle checkout and Pay by EFT together", () => {
    expect(container?.textContent).toContain("Access ended")
    expect(
      container?.querySelector('button')?.textContent
    ).toContain("Subscribe with Paddle")
    expect(container?.querySelector('[data-testid="eft-payment-options"]'))
      .toBeTruthy()
    expect(container?.textContent).toContain("or")
  })
})
