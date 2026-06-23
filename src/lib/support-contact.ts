import { isTauriRuntime } from "@/lib/tauri-runtime"

export const SUPPORT_EMAIL = "fanelesibonge50@gmail.com"
const DEFAULT_SUBJECT = "SabbathCue support request"

export type RenewalPlanId = "standard" | "annual"

export interface RenewalPlan {
  id: RenewalPlanId
  name: string
  price: string
  term: string
  emailLabel: string
}

export const RENEWAL_PLANS = [
  {
    id: "standard",
    name: "Standard",
    price: "R199",
    term: "per month",
    emailLabel: "Standard monthly - R199/month",
  },
  {
    id: "annual",
    name: "Annual",
    price: "R1,999",
    term: "per year",
    emailLabel: "Annual - R1,999/year",
  },
] as const satisfies readonly RenewalPlan[]

export interface SupportEmailOptions {
  subject?: string
  body?: string
}

export interface RenewalEmailOptions {
  accountEmail?: string | null
}

function optionsFromInput(
  input?: string | SupportEmailOptions
): SupportEmailOptions {
  return typeof input === "string" ? { subject: input } : (input ?? {})
}

export function buildSupportEmailUrl(
  input?: string | SupportEmailOptions
): string {
  const options = optionsFromInput(input)
  const params = new URLSearchParams({
    subject: options.subject?.trim() || DEFAULT_SUBJECT,
  })

  if (options.body?.trim()) {
    params.set("body", options.body.trim())
  }

  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`
}

export function getRenewalPlan(planId: RenewalPlanId): RenewalPlan {
  return RENEWAL_PLANS.find((plan) => plan.id === planId) ?? RENEWAL_PLANS[0]
}

export function buildRenewalEmailOptions(
  planId: RenewalPlanId,
  options: RenewalEmailOptions = {}
): SupportEmailOptions {
  const plan = getRenewalPlan(planId)
  const accountEmail = options.accountEmail?.trim() ?? ""

  return {
    subject: `SabbathCue ${plan.name} renewal`,
    body: [
      "Hi Fanele,",
      "",
      "Please renew my SabbathCue access.",
      "",
      `Selected plan: ${plan.emailLabel}`,
      `Account email: ${accountEmail}`,
      "Payment/reference:",
      "Church name:",
      "",
      "Thank you.",
    ].join("\n"),
  }
}

export async function openSupportEmail(
  input?: string | SupportEmailOptions
): Promise<void> {
  const url = buildSupportEmailUrl(input)

  if (typeof window === "undefined") return

  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener")
      await openUrl(url)
      return
    } catch {
      // Fall back to browser navigation if the opener plugin is unavailable.
    }
  }

  window.location.href = url
}
