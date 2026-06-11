import { useState, type ComponentProps, type FormEvent } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LogInIcon,
  MailIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserPlusIcon,
} from "lucide-react"
import { AppLogo } from "@/components/ui/app-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { cn } from "@/lib/utils"
import { requestPasswordReset } from "@/lib/supabase/auth"
import { useVerificationStore } from "@/stores/verification-store"
import type {
  VerificationErrorCode,
  VerificationStatus,
} from "@/types/verification"

type AuthMode = "sign-in" | "create-account"
type NoticeTone = "success" | "error" | "info"
type PendingAction = AuthMode | "reset-password" | null

const MIN_PASSWORD_LENGTH = 6

const AUTH_MODE_OPTIONS = [
  { value: "sign-in", label: "Sign in" },
  { value: "create-account", label: "Create account" },
] satisfies Array<{ value: AuthMode; label: string }>

function formatErrorMessage(
  errorCode: VerificationErrorCode | null,
  error: string | null
): string {
  switch (errorCode) {
    case "invalid_credentials":
      return "Email or password is incorrect."
    case "email_not_confirmed":
      return "Confirm your email address before signing in."
    case "device_limit_reached":
      return (
        error ??
        "This account is already registered on the maximum number of devices."
      )
    case "suspended":
      return (
        error ??
        "This account has been suspended. Contact support for assistance."
      )
    case "network":
      return "Unable to connect. Check your network and try again."
    default:
      return error ?? "Sign in failed. Try again when ready."
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Enter your email address."
  if (!isValidEmail(email.trim())) return "Enter a valid email address."
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return "Enter your password."
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

function modeTitle(mode: AuthMode, status: VerificationStatus): string {
  if (status === "expired") return "Session expired"
  if (status === "checking") return "Checking your account"
  return mode === "create-account" ? "Create your account" : "Sign in"
}

function modeDescription(mode: AuthMode, status: VerificationStatus): string {
  if (status === "expired") {
    return "Your saved session is no longer valid. Sign in again or clear it."
  }
  if (status === "checking") {
    return "This should only take a moment."
  }
  if (mode === "create-account") {
    return "Use the email address you want connected to this installation."
  }
  return "Continue with your SabbathCue account."
}

function AuthNotice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: string
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2Icon
      : tone === "error"
        ? ShieldAlertIcon
        : ShieldCheckIcon

  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2 text-left text-xs leading-relaxed",
        tone === "success" &&
          "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        tone === "error" && "border-red-400/25 bg-red-400/10 text-red-100",
        tone === "info" && "border-sky-400/25 bg-sky-400/10 text-sky-100"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Field({
  label,
  help,
  ...props
}: ComponentProps<typeof Input> & {
  label: string
  help?: string
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left text-xs font-medium text-slate-300">
      <span>{label}</span>
      <Input {...props} />
      {help ? (
        <span className="text-[11px] leading-relaxed font-normal text-slate-500">
          {help}
        </span>
      ) : null}
    </label>
  )
}

function PasswordResetForm({
  initialEmail,
  busy,
  onBusyChange,
  onBack,
}: {
  initialEmail: string
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onBack: (notice?: string) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<NoticeTone>("info")

  async function handleSendLink(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const nextEmail = email.trim()
    const emailError = validateEmail(nextEmail)
    if (emailError) {
      setTone("error")
      setMessage(emailError)
      return
    }

    onBusyChange(true)
    setMessage(null)
    const result = await requestPasswordReset(nextEmail)
    onBusyChange(false)

    if (!result.ok) {
      setTone("error")
      setMessage(result.message)
      return
    }

    setSentEmail(nextEmail)
    setTone("success")
    setMessage(
      `Reset link sent to ${nextEmail}. Open the latest email and choose a new password.`
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void handleSendLink(event)}
    >
      <button
        type="button"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        disabled={busy}
        onClick={() =>
          onBack(
            sentEmail
              ? `Reset link sent to ${sentEmail}. After updating it in your browser, sign in with the new password.`
              : undefined
          )
        }
      >
        <ArrowLeftIcon className="size-3.5" />
        Sign in
      </button>

      <div className="space-y-1 text-left">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <KeyRoundIcon className="size-5 text-[var(--brand-accent)]" />
          Reset password
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Send a recovery link to the email on your SabbathCue account.
        </p>
      </div>

      {message ? <AuthNotice tone={tone}>{message}</AuthNotice> : null}

      <Field
        autoComplete="email"
        disabled={busy}
        label="Email"
        placeholder="you@example.com"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <Button className="w-full" disabled={busy} type="submit">
        {busy ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            Sending
          </>
        ) : (
          <>
            <MailIcon className="size-4" />
            {sentEmail ? "Resend reset link" : "Send reset link"}
          </>
        )}
      </Button>
    </form>
  )
}

export function VerificationScreen() {
  const status = useVerificationStore((s) => s.status)
  const error = useVerificationStore((s) => s.error)
  const errorCode = useVerificationStore((s) => s.errorCode)
  const signIn = useVerificationStore((s) => s.signIn)
  const signUp = useVerificationStore((s) => s.signUp)
  const signOut = useVerificationStore((s) => s.signOut)
  const refresh = useVerificationStore((s) => s.refresh)

  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [localTone, setLocalTone] = useState<NoticeTone>("info")
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const isChecking = status === "checking"
  const isBusy = isChecking || pendingAction !== null
  const staleSession = status === "expired"
  const storeNotice = status === "required" && error ? error : null
  const storeError =
    status === "error" ? formatErrorMessage(errorCode, error) : null
  const canRetry =
    (status === "error" && errorCode === "network") || staleSession
  const visibleMessage = localMessage ?? storeError ?? storeNotice
  const visibleTone: NoticeTone =
    localMessage !== null ? localTone : storeError ? "error" : "success"

  function setModeAndClear(nextMode: AuthMode) {
    setMode(nextMode)
    setShowReset(false)
    setLocalMessage(null)
    setLocalTone("info")
    setConfirmPassword("")
  }

  function validateCredentials(
    nextEmail: string,
    nextPassword: string
  ): string | null {
    return validateEmail(nextEmail) ?? validatePassword(nextPassword)
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextEmail = email.trim()
    const validationError = validateCredentials(nextEmail, password)
    if (validationError) {
      setLocalTone("error")
      setLocalMessage(validationError)
      return
    }

    setLocalMessage(null)
    setPendingAction("sign-in")
    await signIn(nextEmail, password)
    setPendingAction(null)
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextEmail = email.trim()
    const validationError = validateCredentials(nextEmail, password)
    if (validationError) {
      setLocalTone("error")
      setLocalMessage(validationError)
      return
    }
    if (password !== confirmPassword) {
      setLocalTone("error")
      setLocalMessage("Passwords do not match.")
      return
    }

    setLocalMessage(null)
    setPendingAction("create-account")
    await signUp(nextEmail, password)

    const nextState = useVerificationStore.getState()
    if (nextState.status === "required" && nextState.error) {
      setMode("sign-in")
      setPassword("")
      setConfirmPassword("")
      setLocalTone("success")
      setLocalMessage(nextState.error)
    }
    setPendingAction(null)
  }

  const submitLabel =
    mode === "create-account"
      ? pendingAction === "create-account"
        ? "Creating account"
        : "Create account"
      : pendingAction === "sign-in"
        ? "Signing in"
        : "Sign in"
  const SubmitIcon = mode === "create-account" ? UserPlusIcon : LogInIcon

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-[var(--bg-deep)] p-4 text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),transparent_35%,rgba(16,185,129,0.08)_70%,rgba(14,165,233,0.1))]" />
      <main className="relative grid w-full max-w-4xl overflow-hidden rounded-[8px] border border-white/10 bg-[rgba(3,5,10,0.92)] shadow-[0_28px_90px_rgba(0,0,0,0.65)] md:grid-cols-[0.9fr_1.1fr]">
        <section
          aria-label="SabbathCue account"
          className="hidden border-r border-white/10 bg-black/20 p-8 md:flex md:flex-col md:justify-between"
        >
          <div className="space-y-8">
            <AppLogo size="lg" />
            <p className="max-w-xs text-2xl leading-tight font-semibold text-white">
              SabbathCue account
            </p>
          </div>
          <div
            aria-hidden="true"
            className="h-44 rounded-[8px] border border-white/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(16,185,129,0.08),rgba(14,165,233,0.14))]"
          >
            <div className="h-full bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35" />
          </div>
        </section>

        <section className="p-5 sm:p-8">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
            <div className="flex items-center justify-between gap-3 md:hidden">
              <AppLogo size="md" />
              <ShieldCheckIcon className="size-5 text-[var(--brand-accent)]" />
            </div>

            {showReset ? (
              <PasswordResetForm
                busy={pendingAction === "reset-password"}
                initialEmail={email.trim()}
                onBusyChange={(busy) =>
                  setPendingAction(busy ? "reset-password" : null)
                }
                onBack={(notice) => {
                  setShowReset(false)
                  if (notice) {
                    setLocalTone("success")
                    setLocalMessage(notice)
                  }
                }}
              />
            ) : (
              <>
                <div className="space-y-4">
                  <SegmentedControl
                    aria-label="Authentication mode"
                    className="w-full justify-center"
                    options={AUTH_MODE_OPTIONS}
                    value={mode}
                    onChange={setModeAndClear}
                  />

                  <div className="space-y-1 text-left">
                    <h1 className="text-xl font-semibold text-white">
                      {modeTitle(mode, status)}
                    </h1>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {modeDescription(mode, status)}
                    </p>
                  </div>
                </div>

                {visibleMessage ? (
                  <AuthNotice tone={visibleTone}>{visibleMessage}</AuthNotice>
                ) : null}

                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) =>
                    mode === "create-account"
                      ? void handleSignUp(event)
                      : void handleSignIn(event)
                  }
                >
                  <Field
                    autoComplete="email"
                    disabled={isBusy}
                    label="Email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <Field
                    autoComplete={
                      mode === "create-account"
                        ? "new-password"
                        : "current-password"
                    }
                    disabled={isBusy}
                    help={
                      mode === "create-account"
                        ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
                        : undefined
                    }
                    label="Password"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  {mode === "create-account" ? (
                    <Field
                      autoComplete="new-password"
                      disabled={isBusy}
                      label="Confirm password"
                      placeholder="Confirm password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                    />
                  ) : null}

                  <Button className="w-full" disabled={isBusy} type="submit">
                    {pendingAction === mode ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : (
                      <SubmitIcon className="size-4" />
                    )}
                    {submitLabel}
                  </Button>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4">
                  <Button
                    disabled={isBusy}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setLocalMessage(null)
                      setShowReset(true)
                    }}
                  >
                    <KeyRoundIcon className="size-4" />
                    Forgot password?
                  </Button>

                  {canRetry ? (
                    <Button
                      disabled={isBusy}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => void refresh()}
                    >
                      <LoaderCircleIcon className="size-4" />
                      Retry
                    </Button>
                  ) : null}

                  {staleSession ? (
                    <Button
                      disabled={isBusy}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => void signOut()}
                    >
                      <ArrowLeftIcon className="size-4" />
                      Clear session
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
