import { CATALOG_PRICING } from "../catalog-pricing";

export const LEGAL_CONTACT_EMAIL = "fanelesibonge50@gmail.com";
export const LEGAL_ENTITY = "BongaNdlovu";
export const PRODUCT_NAME = "SabbathCue";

export const LEGAL_LAST_UPDATED = "2026-07-24";

export const termsSections = [
  {
    title: "Agreement",
    body: `By downloading, installing, or using ${PRODUCT_NAME}, you agree to these Terms of Service. If you do not agree, do not use the software.`,
  },
  {
    title: "Service description",
    body: `${PRODUCT_NAME} is desktop software for church media teams. It listens to live audio, detects Bible and Ellen G. White references, and displays verses on an HDMI/projector output. Cloud speech providers and Paddle billing are optional and require your own accounts or an active subscription.`,
  },
  {
    title: "Accounts and access",
    body: `You must provide accurate account information. Paid access is licensed per account with a device activation limit described at checkout. You are responsible for activity under your account credentials.`,
  },
  {
    title: "Acceptable use",
    body: `Do not misuse the service, attempt to bypass licensing, reverse engineer the software except where law permits, or use ${PRODUCT_NAME} in violation of applicable law or third-party rights (including Bible translation licenses you add yourself).`,
  },
  {
    title: "Subscription billing",
    body: `Renewals are processed by Paddle. Prices, billing interval, and trial terms shown at checkout apply. Taxes may be added based on your location.`,
  },
  {
    title: "Limitation of liability",
    body: `${PRODUCT_NAME} is provided "as is" to the maximum extent permitted by law. ${LEGAL_ENTITY} is not liable for indirect, incidental, or consequential damages arising from live production use, missed detections, or service interruptions.`,
  },
  {
    title: "Contact",
    body: `Questions about these terms: ${LEGAL_CONTACT_EMAIL}`,
  },
] as const;

export const privacySections = [
  {
    title: "Who we are",
    body: `${LEGAL_ENTITY} operates ${PRODUCT_NAME}. Contact: ${LEGAL_CONTACT_EMAIL}.`,
  },
  {
    title: "Data we process",
    body: `Account email and subscription status are stored in Supabase for sign-in and licensing. Paddle processes payment data when you subscribe. Local speech transcription (Vosk) runs on your machine; cloud STT providers receive audio only when you configure them with your own API keys.`,
  },
  {
    title: "How we use data",
    body: `We use account data to authenticate you, enforce licensing, provide support, and send service-related email (renewal reminders, billing notices). We do not sell personal data.`,
  },
  {
    title: "Retention",
    body: `Account and billing mirror data are kept while your account is active and as required for tax, fraud prevention, and legal obligations. You may request deletion by emailing ${LEGAL_CONTACT_EMAIL}.`,
  },
  {
    title: "Your rights",
    body: `Depending on your jurisdiction you may have rights to access, correct, or delete personal data. Contact us at ${LEGAL_CONTACT_EMAIL} to exercise these rights.`,
  },
  {
    title: "Cookies and analytics",
    body: `The marketing site uses minimal browser storage for checkout and auth. We do not use third-party advertising trackers on the checkout flow.`,
  },
] as const;

export const refundSections = [
  {
    title: "Free trial",
    body: `${PRODUCT_NAME} includes a ${CATALOG_PRICING.trialDays}-day app trial without payment details. Paddle paid plans may include a separate checkout trial as shown at checkout.`,
  },
  {
    title: "Cancellation",
    body: `You may cancel renewal from the desktop app (Account settings) or by emailing ${LEGAL_CONTACT_EMAIL}. Cancellation stops future renewals; access continues until the end of the current paid billing period.`,
  },
  {
    title: "Refunds",
    body: `Fees already paid for the current billing period are not refunded when you cancel, except where required by applicable consumer law or expressly approved by ${LEGAL_ENTITY} in writing.`,
  },
  {
    title: "Chargebacks",
    body: `If you believe a charge is incorrect, contact ${LEGAL_CONTACT_EMAIL} before initiating a chargeback so we can resolve the issue.`,
  },
  {
    title: "Pricing reference",
    body: `Current published prices: ${CATALOG_PRICING.monthly.display} per month or ${CATALOG_PRICING.yearly.display} per year (South Africa list pricing; localized amounts may appear at checkout).`,
  },
] as const;
