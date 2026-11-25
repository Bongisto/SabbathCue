import { describe, expect, it } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"
import { validateAndNormalizeImportedTheme } from "./theme-designer-files"

describe("validateAndNormalizeImportedTheme (FU-30)", () => {
  it("rejects non-objects and malformed theme shapes from Rust shallow check", () => {
    expect(() => validateAndNormalizeImportedTheme(null)).toThrow()
    expect(() => validateAndNormalizeImportedTheme("bad")).toThrow()
    expect(() =>
      validateAndNormalizeImportedTheme({
        id: "t1",
        name: "Bad Theme",
        background: "#ffffff",
        layout: "standard",
        resolution: "1080p",
      }),
    ).toThrow()
  })

  it("rejects missing required nested sections and invalid resolution dimensions", () => {
    expect(() =>
      validateAndNormalizeImportedTheme({
        id: "t1",
        name: "Missing Text",
        background: { type: "solid", color: "#000" },
        layout: {},
        resolution: { width: 1920, height: 1080 },
      }),
    ).toThrow()

    for (const badResolution of [
      { width: 0, height: 1080 },
      { width: 1920, height: 0 },
      { width: -10, height: 1080 },
      { width: Number.NaN, height: 1080 },
    ]) {
      expect(() =>
        validateAndNormalizeImportedTheme({
          id: "t1",
          name: "Bad Res",
          background: { type: "solid", color: "#000" },
          layout: {},
          verseText: {},
          reference: {},
          resolution: badResolution,
        }),
      ).toThrow()
    }
  })

  it("deep-merges partial valid themes against default BroadcastTheme fields", () => {
    const normalized = validateAndNormalizeImportedTheme({
      id: "old-id",
      name: "Imported Minimal",
      builtin: true,
      resolution: { width: 1280, height: 720 },
      background: { type: "solid", color: "#112233" },
      layout: { textAlign: "left" },
      verseText: { fontSize: 64 },
      reference: { color: "#fedcba" },
    })

    const base = BUILTIN_THEMES[0]
    expect(normalized.builtin).toBe(false)
    expect(normalized.id).not.toBe("old-id")
    expect(normalized.resolution).toEqual({ width: 1280, height: 720 })
    expect(normalized.background).toEqual({
      type: "solid",
      color: "#112233",
      gradient: null,
      image: null,
    })
    expect(normalized.layout.textAlign).toBe("left")
    expect(normalized.layout.padding).toEqual(base.layout.padding)
    expect(normalized.textBox).toEqual(base.textBox)
    expect(normalized.verseNumbers).toEqual(base.verseNumbers)
    expect(normalized.transition).toEqual(base.transition)
    expect(normalized.verseText.fontSize).toBe(64)
    expect(normalized.verseText.fontFamily).toBe(base.verseText.fontFamily)
    expect(normalized.reference.color).toBe("#fedcba")
  })
})
