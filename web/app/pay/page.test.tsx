import { describe, expect, it } from "vitest";

describe("app/pay/page", () => {
  it("default-exports a page component", async () => {
    const mod = await import("./page");
    expect(typeof mod.default).toBe("function");
  });
});
