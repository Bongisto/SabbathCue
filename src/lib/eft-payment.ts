import {
  getRenewalPlan,
  type RenewalPlanId,
  type SupportEmailOptions,
} from "@/lib/support-contact"

export type EftPlanId = RenewalPlanId

export interface EftBankDetails {
  accountName: string
  bankName: string
  accountNumber: string
  branchCode: string
  accountType: string
}

function readEnv(name: string): string {
  return import.meta.env[name]?.trim() ?? ""
}

/** Bank details for South African EFT — set VITE_EFT_* in root .env. */
export function getEftBankDetails(): EftBankDetails {
  return {
    accountName: readEnv("VITE_EFT_ACCOUNT_NAME") || "BongaNdlovu",
    bankName: readEnv("VITE_EFT_BANK_NAME"),
    accountNumber: readEnv("VITE_EFT_ACCOUNT_NUMBER"),
    branchCode: readEnv("VITE_EFT_BRANCH_CODE"),
    accountType: readEnv("VITE_EFT_ACCOUNT_TYPE") || "Cheque",
  }
}

export function isEftPaymentConfigured(): boolean {
  const details = getEftBankDetails()
  return Boolean(
    details.bankName && details.accountNumber && details.branchCode
  )
}

export function suggestEftPaymentReference(accountEmail?: string | null): string {
  const local = accountEmail?.trim().split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "")
  return local ? `SC-${local}`.slice(0, 20) : "SC-SabbathCue"
}

export function formatEftBankDetailsLines(details: EftBankDetails): string[] {
  return [
    `Account name: ${details.accountName}`,
    `Bank: ${details.bankName}`,
    `Account number: ${details.accountNumber}`,
    `Branch code: ${details.branchCode}`,
    `Account type: ${details.accountType}`,
  ]
}

export function buildEftPaymentEmailOptions(
  planId: EftPlanId,
  options: { accountEmail?: string | null; churchName?: string | null } = {}
): SupportEmailOptions {
  const plan = getRenewalPlan(planId)
  const reference = suggestEftPaymentReference(options.accountEmail)
  const churchName = options.churchName?.trim() ?? ""

  const lines = [
    "Hi Fanele,",
    "",
    "I would like to pay for SabbathCue by EFT (South African bank transfer).",
    "",
    `Selected plan: ${plan.emailLabel}`,
    `Account email: ${options.accountEmail?.trim() ?? ""}`,
    churchName ? `Church name: ${churchName}` : "Church name:",
    "",
  ]

  if (isEftPaymentConfigured()) {
    lines.push("I will deposit using these details:", "")
    lines.push(...formatEftBankDetailsLines(getEftBankDetails()))
    lines.push(
      "",
      `Intended payment reference: ${reference}`,
      "Payment/reference on my bank deposit:",
      ""
    )
  } else {
    lines.push(
      "Please reply with your EFT bank details.",
      "",
      `Intended payment reference: ${reference}`,
      ""
    )
  }

  lines.push(
    "Thank you.",
    "",
    "---",
    "After you confirm my deposit, I will use Retry in the app to refresh access."
  )

  return {
    subject: `SabbathCue EFT payment — ${plan.name}`,
    body: lines.join("\n"),
  }
}

/** Maps Paddle/web billing interval to renewal plan id. */
export function eftPlanIdForInterval(
  interval: "month" | "year"
): EftPlanId {
  return interval === "year" ? "annual" : "standard"
}
