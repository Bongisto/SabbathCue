import type { Metadata } from "next";
import { LegalPage } from "../_lib/legal/legal-page";
import { PRODUCT_NAME, privacySections } from "../_lib/legal/content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${PRODUCT_NAME}.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`How ${PRODUCT_NAME} handles account, billing, and usage data.`}
      sections={privacySections}
    />
  );
}
