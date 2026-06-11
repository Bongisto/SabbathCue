import type { ReactNode } from "react"
import { VerificationScreen } from "@/components/verification/VerificationScreen"
import { useVerificationStore } from "@/stores/verification-store"

function isE2eBypass(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("e2e")
  )
}

export function VerificationGate({ children }: { children: ReactNode }) {
  const status = useVerificationStore((s) => s.status)
  const isHydrated = useVerificationStore((s) => s.isHydrated)

  if (isE2eBypass()) {
    return children
  }

  if (!isHydrated || status === "checking") {
    return <VerificationScreen />
  }

  if (status !== "verified") {
    return <VerificationScreen />
  }

  return children
}
