import type { Metadata } from "next";
import { LegalPage } from "../_lib/legal/legal-page";
import { PRODUCT_NAME, refundSections } from "../_lib/legal/content";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `Refund and cancellation policy for ${PRODUCT_NAME} subscriptions.`,
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      description={`Cancellation, refunds, and billing periods for ${PRODUCT_NAME}.`}
      sections={refundSections}
    />
  );
}
