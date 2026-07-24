import type { Metadata } from "next";
import { LegalPage } from "../_lib/legal/legal-page";
import { PRODUCT_NAME, termsSections } from "../_lib/legal/content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${PRODUCT_NAME}.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`Rules for using ${PRODUCT_NAME} software and subscriptions.`}
      sections={termsSections}
    />
  );
}
