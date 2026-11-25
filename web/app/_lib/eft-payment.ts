import { CATALOG_PRICING } from "./catalog-pricing";
import { LEGAL_CONTACT_EMAIL } from "./legal/content";

export type EftPlanId = "standard" | "annual";

export interface EftBankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

const EFT_PLANS = {
  standard: {
    id: "standard" as const,
    name: "Standard",
    price: CATALOG_PRICING.monthly.display,
    term: "per month",
    emailLabel: `Standard monthly - ${CATALOG_PRICING.monthly.display}/month`,
  },
  annual: {
    id: "annual" as const,
    name: "Annual",
    price: CATALOG_PRICING.yearly.display,
    term: "per year",
    emailLabel: `Annual - ${CATALOG_PRICING.yearly.display}/year`,
  },
} as const;

/**
 * NEXT_PUBLIC_* must be read as static property access so Next.js/Turbopack
 * can inline them into the client bundle. Dynamic process.env[name] is always
 * undefined in the browser.
 */
export function getEftBankDetails(): EftBankDetails {
  return {
    accountName:
      process.env.NEXT_PUBLIC_EFT_ACCOUNT_NAME?.trim() || "BongaNdlovu",
    bankName: process.env.NEXT_PUBLIC_EFT_BANK_NAME?.trim() ?? "",
    accountNumber: process.env.NEXT_PUBLIC_EFT_ACCOUNT_NUMBER?.trim() ?? "",
    branchCode: process.env.NEXT_PUBLIC_EFT_BRANCH_CODE?.trim() ?? "",
    accountType: process.env.NEXT_PUBLIC_EFT_ACCOUNT_TYPE?.trim() || "Cheque",
  };
}

export function isEftPaymentConfigured(): boolean {
  const details = getEftBankDetails();
  return Boolean(
    details.bankName && details.accountNumber && details.branchCode
  );
}

export function suggestEftPaymentReference(accountEmail?: string | null): string {
  const local = accountEmail?.trim().split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "");
  return local ? `SC-${local}`.slice(0, 20) : "SC-SabbathCue";
}

export function formatEftBankDetailsLines(details: EftBankDetails): string[] {
  return [
    `Account name: ${details.accountName}`,
    `Bank: ${details.bankName}`,
    `Account number: ${details.accountNumber}`,
    `Branch code: ${details.branchCode}`,
    `Account type: ${details.accountType}`,
  ];
}

export function buildEftPaymentEmailOptions(
  planId: EftPlanId,
  options: { accountEmail?: string | null; churchName?: string | null } = {}
) {
  const plan = EFT_PLANS[planId];
  const reference = suggestEftPaymentReference(options.accountEmail);
  const churchName = options.churchName?.trim() ?? "";

  const lines = [
    "Hi Fanele,",
    "",
    "I would like to pay for SabbathCue by EFT (South African bank transfer).",
    "",
    `Selected plan: ${plan.emailLabel}`,
    `Account email: ${options.accountEmail?.trim() ?? ""}`,
    churchName ? `Church name: ${churchName}` : "Church name:",
    "",
  ];

  if (isEftPaymentConfigured()) {
    lines.push("I will deposit using these details:", "");
    lines.push(...formatEftBankDetailsLines(getEftBankDetails()));
    lines.push(
      "",
      `Intended payment reference: ${reference}`,
      "Payment/reference on my bank deposit:",
      ""
    );
  } else {
    lines.push(
      "Please reply with your EFT bank details.",
      "",
      `Intended payment reference: ${reference}`,
      ""
    );
  }

  lines.push(
    "Thank you.",
    "",
    "---",
    "After you confirm my deposit, I will use Retry in the app to refresh access."
  );

  return {
    subject: `SabbathCue EFT payment — ${plan.name}`,
    body: lines.join("\n"),
  };
}

export function buildEftMailtoUrl(
  planId: EftPlanId,
  options: { accountEmail?: string | null; churchName?: string | null } = {}
): string {
  const emailOptions = buildEftPaymentEmailOptions(planId, options);
  const params = new URLSearchParams({
    subject: emailOptions.subject?.trim() || "SabbathCue EFT payment",
  });
  if (emailOptions.body?.trim()) {
    params.set("body", emailOptions.body.trim());
  }
  return `mailto:${LEGAL_CONTACT_EMAIL}?${params.toString()}`;
}

export function eftPlanIdForInterval(interval: "month" | "year"): EftPlanId {
  return interval === "year" ? "annual" : "standard";
}

export const EFT_PLAN_OPTIONS = [EFT_PLANS.standard, EFT_PLANS.annual] as const;
