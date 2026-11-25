import { describe, expect, it, vi } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"
import {
  calculateScaledFontSize,
  computeVerseLayoutMetrics,
} from "./verse-layout"
import type { BroadcastTheme, VerseRenderData } from "@/types"

function createMockCtx() {
  let fontSizePx = 48
  let currentFont = "48px serif"
  return {
    save: vi.fn(),
    restore: vi.fn(),
    get font() {
      return currentFont
    },
    set font(value: string) {
      currentFont = value
      const match = value.match(/([\d.]+)px/)
      if (match) fontSizePx = Number.parseFloat(match[1])
    },
    measureText: vi.fn((text: string) => ({
      width: text.length * fontSizePx * 0.6,
    })),
  } as unknown as CanvasRenderingContext2D
}

function makeTheme(): BroadcastTheme {
  const base = BUILTIN_THEMES[0]
  return {
    ...base,
    resolution: { width: 1920, height: 1080 },
    layout: {
      ...base.layout,
      backgroundWidth: 100,
      backgroundHeight: 100,
      textAreaWidth: 80,
      textAreaHeight: 80,
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      offsetX: 0,
      offsetY: 0,
      referenceGap: 30,
    },
    verseText: {
      ...base.verseText,
      fontSize: 80,
      lineHeight: 1.4,
      verticalAlign: "middle",
    },
    reference: {
      ...base.reference,
      fontSize: 36,
      position: "below",
      verticalAlign: "middle",
    },
  }
}

describe("verse-layout scaling (FU-07)", () => {
  it("returns minFontSize instead of originalFontSize when even minFontSize overflows", () => {
    const ctx = createMockCtx()
    const theme = makeTheme()
    const longVerse: VerseRenderData = {
      reference: "Esther 8:9",
      segments: [{ verseNumber: 9, text: "word ".repeat(300) }],
    }

    const scaled = calculateScaledFontSize(ctx, theme, longVerse, 400, 120)
    expect(scaled).toBe(24)
  })

  it("scales layout.referenceGap and computes referenceRect.y from the scaled verse height", () => {
    const ctx = createMockCtx()
    const theme = makeTheme()
    const longVerse: VerseRenderData = {
      reference: "Psalm 119:1",
      segments: [{ verseNumber: 1, text: "Blessed are the undefiled ".repeat(24) }],
    }

    const metrics = computeVerseLayoutMetrics(ctx, theme, longVerse, { scale: 0.5 })
    expect(metrics.scaledTheme.layout.referenceGap).toBe(15)
    expect(metrics.scaledFontSize).toBeLessThan(metrics.scaledTheme.verseText.fontSize)
    expect(metrics.verseRect).not.toBeNull()
    expect(metrics.referenceRect).not.toBeNull()
    expect(metrics.referenceRect!.y).toBeCloseTo(
      metrics.verseRect!.y +
        metrics.verseRect!.height +
        metrics.scaledTheme.layout.referenceGap!,
      3
    )
    expect(metrics.referenceRect!.y + metrics.referenceRect!.height).toBeLessThanOrEqual(
      metrics.textRect.y + metrics.textRect.height
    )
  })
})
