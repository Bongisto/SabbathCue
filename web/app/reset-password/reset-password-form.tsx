"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { Button } from "../_components/ui/button"
import { cn } from "../_lib/utils"
import { getSupabaseClient } from "../_lib/supabase-client"

type Phase = "loading" | "ready" | "done" | "invalid"
type NoticeTone = "error" | "success"

const MIN_PASSWORD_LENGTH = 6

function readAuthParam(name: string): string | null {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  return searchParams.get(name) ?? hashParams.get(name)
}

function Notice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2Icon : AlertCircleIcon

  return (
    <div
      className={cn(
        "flex gap-2 rounded-[8px] border px-3 py-2 text-sm leading-relaxed",
        tone === "success"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
          : "border-red-400/25 bg-red-400/10 text-red-100"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setPhase("ready")
      }
    })

    async function markReady() {
      if (!cancelled) {
        setError(null)
        setPhase("ready")
      }
    }

    async function bootstrapRecoverySession() {
      const tokenHash = readAuthParam("token_hash")
      const type = readAuthParam("type")
      const code = readAuthParam("code")
      const accessToken = readAuthParam("access_token")
      const refreshToken = readAuthParam("refresh_token")

      if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        })
        if (!verifyError) {
          await markReady()
          return
        }
      }

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)
        if (!exchangeError) {
          await markReady()
          return
        }
      }

      if (accessToken && refreshToken && (!type || type === "recovery")) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!sessionError) {
          await markReady()
          return
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        await markReady()
        return
      }

      window.setTimeout(() => {
        if (cancelled) return
        void supabase.auth
          .getSession()
          .then(({ data: { session: retrySession } }) => {
            if (!cancelled) {
              setPhase(retrySession ? "ready" : "invalid")
            }
          })
      }, 1200)
    }

    void bootstrapRecoverySession().catch((caughtError: unknown) => {
      if (cancelled) return
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not open this reset link."
      )
      setPhase("invalid")
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setBusy(true)
    const supabase = getSupabaseClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setBusy(false)
      setError(updateError.message)
      return
    }

    await supabase.auth.signOut()
    setBusy(false)
    setPhase("done")
  }

  if (phase === "loading") {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircleIcon className="size-4 animate-spin text-accent" />
        Confirming your reset link...
      </div>
    )
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-4">
        <Notice tone="error">
          {error ??
            "This reset link is invalid or has expired. Request a new one from SabbathCue and open the latest email."}
        </Notice>
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="space-y-4">
        <Notice tone="success">
          Password updated. Return to SabbathCue and sign in with your new
          password.
        </Notice>
      </div>
    )
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="bg-surface flex items-start gap-3 rounded-[8px] border border-border p-3">
        <KeyRoundIcon className="mt-0.5 size-5 shrink-0 text-accent" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Choose a new password for your SabbathCue account.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        <span>New password</span>
        <input
          autoComplete="new-password"
          className="rounded-[8px] border border-border bg-black px-3 py-2 text-foreground transition-colors outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          minLength={MIN_PASSWORD_LENGTH}
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className="text-xs font-normal text-muted-foreground">
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        <span>Confirm password</span>
        <input
          autoComplete="new-password"
          className="rounded-[8px] border border-border bg-black px-3 py-2 text-foreground transition-colors outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          minLength={MIN_PASSWORD_LENGTH}
          required
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button className="w-full" disabled={busy} type="submit">
        {busy ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            Updating
          </>
        ) : (
          <>
            <KeyRoundIcon className="size-4" />
            Update password
          </>
        )}
      </Button>
    </form>
  )
}
