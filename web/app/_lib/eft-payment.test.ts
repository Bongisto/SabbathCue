import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEftMailtoUrl,
  buildEftPaymentEmailOptions,
  eftPlanIdForInterval,
  getEftBankDetails,
  isEftPaymentConfigured,
  suggestEftPaymentReference,
} from "./eft-payment";

describe("eft-payment (web)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_EFT_ACCOUNT_NAME", "BongaNdlovu");
    vi.stubEnv("NEXT_PUBLIC_EFT_BANK_NAME", "Capitec");
    vi.stubEnv("NEXT_PUBLIC_EFT_ACCOUNT_NUMBER", "1234567890");
    vi.stubEnv("NEXT_PUBLIC_EFT_BRANCH_CODE", "470010");
    vi.stubEnv("NEXT_PUBLIC_EFT_ACCOUNT_TYPE", "Savings");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads bank details from NEXT_PUBLIC_EFT_* env vars", () => {
    expect(getEftBankDetails()).toEqual({
      accountName: "BongaNdlovu",
      bankName: "Capitec",
      accountNumber: "1234567890",
      branchCode: "470010",
      accountType: "Savings",
    });
  });

  it("builds mailto URL for annual EFT payment", () => {
    const url = buildEftMailtoUrl("annual", {
      accountEmail: "treasurer@example.com",
    });

    expect(url.startsWith("mailto:fanelesibonge50@gmail.com?")).toBe(true);
    const query = url.split("?")[1] ?? "";
    const params = new URLSearchParams(query);
    expect(params.get("subject")).toBe("SabbathCue EFT payment — Annual");
    expect(params.get("body")).toContain("treasurer@example.com");
    expect(params.get("body")).toContain("Account number: 1234567890");
  })

  it("asks for bank details when EFT env is incomplete", () => {
    vi.stubEnv("NEXT_PUBLIC_EFT_BANK_NAME", "");
    expect(isEftPaymentConfigured()).toBe(false);

    const { body } = buildEftPaymentEmailOptions("standard", {
      accountEmail: "user@example.com",
    });
    expect(body).toContain("Please reply with your EFT bank details.");
    expect(body).not.toContain("Account number:");
  });

  it("suggests reference and maps interval to plan", () => {
    expect(suggestEftPaymentReference("media.team@church.org")).toBe(
      "SC-mediateam"
    );
    expect(eftPlanIdForInterval("year")).toBe("annual");
  });
});
