// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const verificationState = {
  status: "required" as const,
  isHydrated: true,
}

vi.mock("@/stores/verification-store", () => ({
  useVerificationStore: (
    selector: (state: typeof verificationState) => unknown
  ) => selector(verificationState),
}))

vi.mock("@/components/verification/VerificationScreen", () => ({
  VerificationScreen: () => <div data-testid="verification-screen">Gate</div>,
}))

import { VerificationGate } from "./VerificationGate"

describe("VerificationGate e2e bypass gating", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    window.history.replaceState({}, "", "/?e2e=1")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.unstubAllEnvs()
    window.history.replaceState({}, "", "/")
  })

  it("blocks ?e2e bypass when DEV is false and VITE_ENABLE_E2E is unset", async () => {
    vi.stubEnv("DEV", false)
    vi.stubEnv("VITE_ENABLE_E2E", "")

    await act(async () => {
      root?.render(
        <VerificationGate>
          <div data-testid="protected-app">Protected</div>
        </VerificationGate>
      )
    })

    expect(container?.querySelector('[data-testid="verification-screen"]')).toBeTruthy()
    expect(container?.querySelector('[data-testid="protected-app"]')).toBeNull()
  })

  it("allows ?e2e bypass when VITE_ENABLE_E2E is explicitly enabled", async () => {
    vi.stubEnv("DEV", false)
    vi.stubEnv("VITE_ENABLE_E2E", "true")

    await act(async () => {
      root?.render(
        <VerificationGate>
          <div data-testid="protected-app">Protected</div>
        </VerificationGate>
      )
    })

    expect(container?.querySelector('[data-testid="protected-app"]')).toBeTruthy()
    expect(container?.querySelector('[data-testid="verification-screen"]')).toBeNull()
  })
})
