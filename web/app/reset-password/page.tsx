import type { Metadata } from "next"
import { ResetPasswordForm } from "./reset-password-form"
import { SITE } from "../_lib/site"

export const metadata: Metadata = {
  title: "Reset password",
  description: `Reset your ${SITE.name} account password.`,
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="bg-surface w-full max-w-md rounded-[8px] border border-border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">{SITE.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset password
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Finish the password reset from the link sent to your email.
          </p>
        </div>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  )
}
