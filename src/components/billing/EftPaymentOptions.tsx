import { Building2Icon, MailIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildEftPaymentEmailOptions,
  getEftBankDetails,
  isEftPaymentConfigured,
  suggestEftPaymentReference,
  type EftPlanId,
} from "@/lib/eft-payment"
import {
  openSupportEmail,
  RENEWAL_PLANS,
  type RenewalPlanId,
} from "@/lib/support-contact"

export function EftPaymentOptions({
  accountEmail,
  disabled = false,
  onPaidByEft,
}: {
  accountEmail?: string | null
  disabled?: boolean
  /** Called after the user opens the EFT email (for tests/analytics). */
  onPaidByEft?: (planId: EftPlanId) => void
}) {
  const bankConfigured = isEftPaymentConfigured()
  const bank = getEftBankDetails()
  const reference = suggestEftPaymentReference(accountEmail)

  function handlePay(planId: RenewalPlanId) {
    void openSupportEmail(
      buildEftPaymentEmailOptions(planId, { accountEmail })
    ).then(() => onPaidByEft?.(planId))
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 p-4">
      <div className="flex items-start gap-2">
        <Building2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Pay by EFT</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            South African bank transfer. Email us your proof of payment; we
            activate your account manually within one business day.
          </p>
        </div>
      </div>

      {bankConfigured ? (
        <dl className="grid gap-1 rounded-md border border-[var(--border-dim)] bg-[var(--bg-deep)]/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <div>
            <dt className="inline font-semibold text-foreground">Account: </dt>
            <dd className="inline">{bank.accountName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-foreground">Bank: </dt>
            <dd className="inline">{bank.bankName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-foreground">Number: </dt>
            <dd className="inline">{bank.accountNumber}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-foreground">Branch: </dt>
            <dd className="inline">{bank.branchCode}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-foreground">Reference: </dt>
            <dd className="inline">{reference}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-2">
        {RENEWAL_PLANS.map((plan) => (
          <Button
            key={plan.id}
            className="h-auto w-full justify-between gap-3 px-3 py-2 text-left"
            disabled={disabled}
            type="button"
            variant="outline"
            onClick={() => handlePay(plan.id)}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">
                Pay by EFT — {plan.name}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {plan.price} {plan.term}
              </span>
            </span>
            <MailIcon className="size-4 shrink-0" />
          </Button>
        ))}
      </div>
    </div>
  )
}
