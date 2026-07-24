// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockOpenSupportEmail = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/support-contact", () => ({
  openSupportEmail: (...args: unknown[]) => mockOpenSupportEmail(...args),
  RENEWAL_PLANS: [
    {
      id: "standard",
      name: "Standard",
      price: "R200",
      term: "per month",
      emailLabel: "Standard monthly - R200/month",
    },
    {
      id: "annual",
      name: "Annual",
      price: "R2,000",
      term: "per year",
      emailLabel: "Annual - R2,000/year",
    },
  ],
}))

vi.mock("@/lib/eft-payment", () => ({
  isEftPaymentConfigured: () => true,
  getEftBankDetails: () => ({
    accountName: "BongaNdlovu",
    bankName: "FNB",
    accountNumber: "62000000000",
    branchCode: "250655",
    accountType: "Cheque",
  }),
  suggestEftPaymentReference: () => "SC-pastor",
  buildEftPaymentEmailOptions: vi.fn((planId: string) => ({
    subject: `EFT ${planId}`,
    body: `EFT body for ${planId}`,
  })),
}))

describe("EftPaymentOptions", () => {
  beforeEach(() => {
    mockOpenSupportEmail.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders bank details and opens EFT email for each plan", async () => {
    const { EftPaymentOptions } = await import("./EftPaymentOptions")

    render(
      <EftPaymentOptions
        accountEmail="pastor@church.org"
        onPaidByEft={vi.fn()}
      />
    )

    expect(screen.getByText("Pay by EFT")).toBeTruthy()
    expect(screen.getByText(/62000000000/)).toBeTruthy()
    expect(screen.getByText(/SC-pastor/)).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: /Pay by EFT — Standard/i })
    )

    expect(mockOpenSupportEmail).toHaveBeenCalledWith({
      subject: "EFT standard",
      body: "EFT body for standard",
    })

    fireEvent.click(
      screen.getByRole("button", { name: /Pay by EFT — Annual/i })
    )

    expect(mockOpenSupportEmail).toHaveBeenLastCalledWith({
      subject: "EFT annual",
      body: "EFT body for annual",
    })
  })
})
