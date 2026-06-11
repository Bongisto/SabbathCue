import { useState } from "react"
import { ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { useVerificationStore } from "@/stores/verification-store"
import type { VerificationErrorCode } from "@/types/verification"

function errorMessage(
  errorCode: VerificationErrorCode | null,
  error: string | null,
): string {
  switch (errorCode) {
    case "invalid_credentials":
      return "Email or password is incorrect."
    case "email_not_confirmed":
      return "Confirm your email address before signing in."
    case "device_limit_reached":
      return (
        error ??
        "This account is already registered on the maximum number of devices (2)."
      )
    case "suspended":
      return error ?? "This account has been suspended. Contact support for assistance."
    case "network":
      return "Unable to connect. Check your network and try again."
    default:
      return error ?? "Sign in failed. Try again when ready."
  }
}

export function VerificationScreen() {
  const status = useVerificationStore((s) => s.status)
  const error = useVerificationStore((s) => s.error)
  const errorCode = useVerificationStore((s) => s.errorCode)
  const signIn = useVerificationStore((s) => s.signIn)
  const signUp = useVerificationStore((s) => s.signUp)
  const signOut = useVerificationStore((s) => s.signOut)
  const refresh = useVerificationStore((s) => s.refresh)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const isChecking = status === "checking"
  const showStaleSessionActions = status === "expired"

  const title =
    status === "expired"
      ? "Session expired"
      : status === "error"
        ? "Sign in required"
        : "Sign in to SabbathCue"

  const description =
    status === "checking"
      ? "Checking your account..."
      : status === "expired"
        ? "Your saved session is no longer valid. Sign in again or clear the stale session."
        : status === "error" || status === "required"
          ? errorMessage(errorCode, error)
          : "Sign in with your SabbathCue account to continue."

  async function handleSignIn() {
    await signIn(email.trim(), password)
  }

  async function handleSignUp() {
    await signUp(email.trim(), password)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card">
        <PanelEmptyState
          icon={<ShieldCheckIcon className="size-10" />}
          title={title}
          description={description}
        >
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Input
              autoComplete="email"
              disabled={isChecking}
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              autoComplete="current-password"
              disabled={isChecking}
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button disabled={isChecking || !email || !password} onClick={() => void handleSignIn()}>
              {isChecking ? "Signing in..." : "Sign in"}
            </Button>
            <Button
              disabled={isChecking || !email || !password}
              variant="outline"
              onClick={() => void handleSignUp()}
            >
              {isChecking ? "Working..." : "Create account"}
            </Button>
            {(status === "error" && errorCode === "network") || showStaleSessionActions ? (
              <Button disabled={isChecking} variant="ghost" onClick={() => void refresh()}>
                Retry
              </Button>
            ) : null}
            {showStaleSessionActions ? (
              <Button disabled={isChecking} variant="ghost" onClick={() => void signOut()}>
                Clear stale session
              </Button>
            ) : null}
          </div>
        </PanelEmptyState>
      </div>
    </div>
  )
}
