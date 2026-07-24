import { describe, expect, it } from "vitest"

// Next's App Router requires every app/**/page.tsx to default-export the page
// component. Without it `next build` fails type checking with
// "Property 'default' is missing ... but required in type AppPageConfig".
describe("app/subscribe/page", () => {
  it("default-exports a page component", async () => {
    const mod = await import("./page")
    expect(typeof mod.default).toBe("function")
  })
})
