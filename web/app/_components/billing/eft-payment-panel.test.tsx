// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@tabler/icons-react", () => ({
  IconBuildingBank: () => null,
}))

vi.mock("../ui/button", () => ({
  Button: ({
    href,
    children,
  }: {
    href?: string
    children?: unknown
  }) =>
    href
      ? createElement("a", { href }, children)
      : createElement("button", null, children),
}))

vi.mock("../../_lib/eft-payment", () => ({
  isEftPaymentConfigured: () => true,
  getEftBankDetails: () => ({
    accountName: "BongaNdlovu",
    bankName: "Capitec",
    accountNumber: "1234567890",
    branchCode: "470010",
    accountType: "Savings",
  }),
  suggestEftPaymentReference: () => "SC-buyer",
  buildEftMailtoUrl: () =>
    "mailto:fanelesibonge50@gmail.com?subject=SabbathCue%20EFT",
  eftPlanIdForInterval: (interval: "month" | "year") =>
    interval === "year" ? "annual" : "standard",
  EFT_PLAN_OPTIONS: [
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

describe("EftPaymentPanel", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows bank details and EFT mailto CTA for the selected interval", async () => {
    const { EftPaymentPanel } = await import("./eft-payment-panel")

    render(
      <EftPaymentPanel interval="year" accountEmail="buyer@example.com" />
    )

    expect(screen.getByRole("heading", { name: "Pay by EFT" })).toBeTruthy()
    expect(screen.getByText(/1234567890/)).toBeTruthy()
    expect(screen.getAllByText(/SC-buyer/).length).toBeGreaterThan(0)

    const link = screen.getByRole("link", {
      name: /Pay R2,000 by EFT — email proof/i,
    })
    expect(link.getAttribute("href")).toContain("mailto:fanelesibonge50@gmail.com")
  })
})
