import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// CSS is not executed under jsdom, so these regression tests assert against the
// stylesheet as source text. They guard a batch of UI-polish changes so the old
// pre-polish values cannot silently return.
const REPO_ROOT = join(import.meta.dirname, "../..")
const CSS = readFileSync(join(REPO_ROOT, "src/index.css"), "utf8")
const DASHBOARD = readFileSync(
  join(REPO_ROOT, "src/components/layout/dashboard.tsx"),
  "utf8",
)

// Collapse runs of whitespace so regexes can stay tolerant of formatting while
// still being strict on the actual values.
const CSS_FLAT = CSS.replace(/\s+/g, " ")

describe("index.css chart tokens: teal→sage→copper ramp", () => {
  it("uses the teal→sage→copper oklch hue ramp (190/200/110/48/42) in :root", () => {
    expect(CSS_FLAT).toMatch(/--chart-1:\s*oklch\(0\.66 0\.1 190\)/)
    expect(CSS_FLAT).toMatch(/--chart-2:\s*oklch\(0\.72 0\.09 200\)/)
    expect(CSS_FLAT).toMatch(/--chart-3:\s*oklch\(0\.74 0\.045 110\)/)
    expect(CSS_FLAT).toMatch(/--chart-4:\s*oklch\(0\.62 0\.12 48\)/)
    expect(CSS_FLAT).toMatch(/--chart-5:\s*oklch\(0\.52 0\.11 42\)/)
  })

  it("uses the teal→sage→copper oklch hue ramp in .dark", () => {
    expect(CSS_FLAT).toMatch(/--chart-1:\s*oklch\(0\.78 0\.11 190\)/)
    expect(CSS_FLAT).toMatch(/--chart-2:\s*oklch\(0\.82 0\.09 200\)/)
    expect(CSS_FLAT).toMatch(/--chart-3:\s*oklch\(0\.8 0\.045 110\)/)
    expect(CSS_FLAT).toMatch(/--chart-4:\s*oklch\(0\.7 0\.12 48\)/)
    expect(CSS_FLAT).toMatch(/--chart-5:\s*oklch\(0\.62 0\.12 42\)/)
  })

  it("must not reintroduce the old lime chart defaults (hue ~120-131)", () => {
    // The retired shadcn lime ramp lived around hue 120-131. No --chart token may
    // point back into that band, in either theme.
    const limeChart =
      /--chart-[1-5]:\s*oklch\([^)]*\b12[0-9]\.?\d*\)/g
    expect(CSS_FLAT).not.toMatch(limeChart)
    const lime131 = /--chart-[1-5]:\s*oklch\([^)]*\b13[01]\.?\d*\)/g
    expect(CSS_FLAT).not.toMatch(lime131)
    // The exact retired default must be gone.
    expect(CSS).not.toContain("oklch(0.897 0.196 126.665)")
  })
})

describe("index.css sidebar-primary mirrors --primary", () => {
  it("uses #2da7a3 / #f9faf6 in :root and #34c6bd / #08100f in .dark", () => {
    expect(CSS_FLAT).toMatch(/--sidebar-primary:\s*#2da7a3/)
    expect(CSS_FLAT).toMatch(/--sidebar-primary-foreground:\s*#f9faf6/)
    expect(CSS_FLAT).toMatch(/--sidebar-primary:\s*#34c6bd/)
    expect(CSS_FLAT).toMatch(/--sidebar-primary-foreground:\s*#08100f/)
  })
})

describe("index.css .queue-item hover must not shift layout", () => {
  // Extract just the .queue-item:hover block.
  const hoverBlock = CSS.match(/\.queue-item:hover\s*\{([^}]*)\}/)?.[1] ?? ""

  it("draws the accent rail with inset box-shadow", () => {
    expect(hoverBlock).toMatch(
      /box-shadow:\s*inset\s+3px\s+0\s+0\s+var\(--accent\)/,
    )
  })

  it("does not use border-left / padding-left / !important (the layout-shift cause)", () => {
    expect(hoverBlock).not.toMatch(/border-left/)
    expect(hoverBlock).not.toMatch(/padding-left/)
    expect(hoverBlock).not.toMatch(/!important/)
  })
})

describe("index.css .btn-action spring transitions", () => {
  const baseBlock = CSS.match(/\.btn-action\s*\{([^}]*)\}/)?.[1] ?? ""
  const activeBlock =
    CSS.match(/\.btn-action:active:not\(:disabled\)\s*\{([^}]*)\}/)?.[1] ?? ""
  const hoverBlock =
    CSS.match(/\.btn-action:hover:not\(:disabled\)\s*\{([^}]*)\}/)?.[1] ?? ""

  it("base rule uses per-property transitions, never `transition: all`", () => {
    expect(baseBlock).not.toMatch(/transition:\s*all\b/)
  })

  it("base rule springs transform at 0.35s on the overshoot curve", () => {
    expect(baseBlock.replace(/\s+/g, " ")).toMatch(
      /transform 0\.35s cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/,
    )
  })

  it(":active presses to scale(0.965) with an 80ms transform duration", () => {
    expect(activeBlock).toMatch(/transform:\s*scale\(0\.965\)/)
    expect(activeBlock.replace(/\s+/g, " ")).toMatch(/80ms/)
  })

  it(":hover lifts translateY(-1px) with brightness(1.05)", () => {
    expect(hoverBlock).toMatch(/transform:\s*translateY\(-1px\)/)
    expect(hoverBlock).toMatch(/filter:\s*brightness\(1\.05\)/)
  })
})

describe("index.css .view-pane staggered child animation", () => {
  it("animation lives on `.view-pane > *` with fade-in-up 0.32s house-ease both", () => {
    const block = CSS.match(/\.view-pane > \*\s*\{([^}]*)\}/)?.[1] ?? ""
    expect(block.replace(/\s+/g, " ")).toMatch(
      /animation:\s*fade-in-up 0\.32s cubic-bezier\(0\.16, 1, 0\.3, 1\) both/,
    )
  })

  it("uses nth-child stagger delays 45/90/135/180ms and a :nth-child(n + 6) cap at 225ms", () => {
    expect(CSS_FLAT).toMatch(
      /\.view-pane > \*:nth-child\(2\)\s*\{\s*animation-delay:\s*45ms/,
    )
    expect(CSS_FLAT).toMatch(
      /\.view-pane > \*:nth-child\(3\)\s*\{\s*animation-delay:\s*90ms/,
    )
    expect(CSS_FLAT).toMatch(
      /\.view-pane > \*:nth-child\(4\)\s*\{\s*animation-delay:\s*135ms/,
    )
    expect(CSS_FLAT).toMatch(
      /\.view-pane > \*:nth-child\(5\)\s*\{\s*animation-delay:\s*180ms/,
    )
    expect(CSS_FLAT).toMatch(
      /\.view-pane > \*:nth-child\(n \+ 6\)\s*\{\s*animation-delay:\s*225ms/,
    )
  })

  it("fade-in-up keyframes contain no filter: blur (jank on low-end machines)", () => {
    const keyframes =
      CSS.match(/@keyframes fade-in-up\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
    expect(keyframes).not.toMatch(/filter:\s*blur/)
  })
})

describe("index.css prefers-reduced-motion honours the polish", () => {
  it("includes `.view-pane > *` in an animation:none rule", () => {
    // The animation:none selector list must include the staggered children.
    expect(CSS_FLAT).toMatch(/\.view-pane > \*,[^{]*\{\s*animation:\s*none/)
  })

  it("neutralises `.btn-action:active:not(:disabled)` transform", () => {
    expect(CSS_FLAT).toMatch(
      /\.btn-action:active:not\(:disabled\)\s*\{[^}]*transform:\s*none/,
    )
  })
})

describe("dashboard LiveDeskPage uses clamp() panel heights", () => {
  it("declares the clamp()-based responsive panel heights", () => {
    expect(DASHBOARD).toContain("h-[clamp(560px,77vh,880px)]")
    expect(DASHBOARD).toContain("h-[clamp(360px,47vh,560px)]")
    expect(DASHBOARD).toContain("h-[clamp(240px,31vh,380px)]")
  })

  it("does not reintroduce the legacy fixed panel heights", () => {
    expect(DASHBOARD).not.toContain("h-[720px]")
    expect(DASHBOARD).not.toContain("h-[440px]")
    expect(DASHBOARD).not.toContain("h-[290px]")
  })
})
