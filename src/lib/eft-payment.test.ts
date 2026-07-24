import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildEftPaymentEmailOptions,
  eftPlanIdForInterval,
  getEftBankDetails,
  isEftPaymentConfigured,
  suggestEftPaymentReference,
} from "./eft-payment"

describe("eft-payment (desktop)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_EFT_ACCOUNT_NAME", "BongaNdlovu")
    vi.stubEnv("VITE_EFT_BANK_NAME", "FNB")
    vi.stubEnv("VITE_EFT_ACCOUNT_NUMBER", "62000000000")
    vi.stubEnv("VITE_EFT_BRANCH_CODE", "250655")
    vi.stubEnv("VITE_EFT_ACCOUNT_TYPE", "Cheque")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads bank details from VITE_EFT_* env vars", () => {
    expect(getEftBankDetails()).toEqual({
      accountName: "BongaNdlovu",
      bankName: "FNB",
      accountNumber: "62000000000",
      branchCode: "250655",
      accountType: "Cheque",
    })
  })

  it("is configured when bank, account number, and branch are set", () => {
    expect(isEftPaymentConfigured()).toBe(true)
    vi.stubEnv("VITE_EFT_BANK_NAME", "")
    expect(isEftPaymentConfigured()).toBe(false)
  })

  it("suggests a payment reference from account email", () => {
    expect(suggestEftPaymentReference("pastor@church.org")).toBe("SC-pastor")
    expect(suggestEftPaymentReference(null)).toBe("SC-SabbathCue")
  })

  it("builds EFT email with plan and bank details", () => {
    const options = buildEftPaymentEmailOptions("standard", {
      accountEmail: "pastor@church.org",
      churchName: "Central SDA",
    })

    expect(options.subject).toBe("SabbathCue EFT payment — Standard")
    expect(options.body).toContain("pay for SabbathCue by EFT")
    expect(options.body).toContain("Standard monthly - R200/month")
    expect(options.body).toContain("pastor@church.org")
    expect(options.body).toContain("Central SDA")
    expect(options.body).toContain("Account number: 62000000000")
    expect(options.body).toContain("Intended payment reference: SC-pastor")
    expect(options.body).toContain("use Retry in the app")
  })

  it("maps billing interval to renewal plan id", () => {
    expect(eftPlanIdForInterval("month")).toBe("standard")
    expect(eftPlanIdForInterval("year")).toBe("annual")
  })
})
