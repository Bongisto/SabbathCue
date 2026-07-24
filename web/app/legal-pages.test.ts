import { describe, expect, it } from "vitest";
import { refundSections, termsSections } from "./_lib/legal/content";

describe("legal policy pages", () => {
  it.each([
    ["terms", () => import("./terms/page")],
    ["privacy", () => import("./privacy/page")],
    ["refund", () => import("./refund/page")],
  ])("app/%s/page default-exports a component", async (_name, load) => {
    const mod = await load();
    expect(typeof mod.default).toBe("function");
    expect(mod.metadata?.title).toBeTruthy();
  });

  it("refund policy references catalog pricing", () => {
    const pricing = refundSections.find((s) => s.title === "Pricing reference");
    expect(pricing?.body).toContain("R200");
    expect(pricing?.body).toContain("R2,000");
  });

  it("terms mention Paddle billing", () => {
    const billing = termsSections.find((s) => s.title === "Subscription billing");
    expect(billing?.body).toContain("Paddle");
  });
});
