import { IconBuildingBank } from "@tabler/icons-react";
import { Button } from "../ui/button";
import {
  buildEftMailtoUrl,
  eftPlanIdForInterval,
  EFT_PLAN_OPTIONS,
  getEftBankDetails,
  isEftPaymentConfigured,
  suggestEftPaymentReference,
  type EftPlanId,
} from "../../_lib/eft-payment";
import type { BillingInterval } from "../../_lib/paddle/pricing-tier";

export function EftPaymentPanel({
  interval,
  accountEmail,
}: {
  interval: BillingInterval;
  accountEmail?: string;
}) {
  const bankConfigured = isEftPaymentConfigured();
  const bank = getEftBankDetails();
  const reference = suggestEftPaymentReference(accountEmail);
  const primaryPlanId: EftPlanId = eftPlanIdForInterval(interval);
  const primaryPlan =
    EFT_PLAN_OPTIONS.find((plan) => plan.id === primaryPlanId) ??
    EFT_PLAN_OPTIONS[0];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-strong bg-muted/20 p-6">
      <div className="flex items-start gap-3">
        <IconBuildingBank className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Pay by EFT</h2>
          <p className="text-sm text-muted-foreground">
            Prefer a South African bank transfer? Deposit the amount below and
            email us your proof of payment. We activate access manually — usually
            within one business day.
          </p>
        </div>
      </div>

      {bankConfigured ? (
        <dl className="grid gap-1 rounded-md border border-border-strong bg-background/60 px-4 py-3 font-mono text-xs text-muted-foreground">
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

      <Button
        href={buildEftMailtoUrl(primaryPlanId, { accountEmail })}
        variant="secondary"
        size="lg"
      >
        Pay {primaryPlan.price} by EFT — email proof
      </Button>

      <p className="text-xs text-muted-foreground">
        Use reference <span className="font-mono text-foreground">{reference}</span>{" "}
        on your deposit. Include your SabbathCue account email in the email body.
      </p>
    </div>
  );
}
