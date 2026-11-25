import { open, save } from "@tauri-apps/plugin-dialog"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { BroadcastTheme } from "@/types"
import type { BroadcastKineticTheme } from "@/types/broadcast"

type JsonRecord = Record<string, unknown>

const BACKGROUND_TYPES = new Set(["solid", "gradient", "image", "transparent"])
const GRADIENT_TYPES = new Set(["linear", "radial"])
const IMAGE_FITS = new Set(["cover", "contain", "stretch"])
const HORIZONTAL_ALIGNS = new Set(["left", "center", "right", "justify"])
const VERTICAL_ALIGNS = new Set(["top", "middle", "bottom"])
const TEXT_TRANSFORMS = new Set(["none", "uppercase", "lowercase", "capitalize"])
const TEXT_DECORATIONS = new Set(["none", "underline", "line-through"])
const REFERENCE_POSITIONS = new Set(["above", "below", "inline"])
const LAYOUT_ANCHORS = new Set([
  "center",
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
])
const TEXT_ALIGNS = new Set(["left", "center", "right"])
const TRANSITION_TYPES = new Set(["fade", "slide", "scale", "none"])
const TRANSITION_EASINGS = new Set([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
])
const TRANSITION_DIRECTIONS = new Set(["up", "down", "left", "right"])

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireObject(parent: JsonRecord, key: string): JsonRecord {
  const value = parent[key]
  if (!isPlainObject(value)) {
    throw new Error(`Invalid theme: missing or invalid '${key}'`)
  }
  return value
}

function optionalObject(
  parent: JsonRecord,
  key: string,
): JsonRecord | undefined {
  const value = parent[key]
  if (value === undefined) return undefined
  if (!isPlainObject(value)) {
    throw new Error(`Invalid theme: '${key}' must be an object`)
  }
  return value
}

function nullableObject(
  parent: JsonRecord,
  key: string,
): JsonRecord | null | undefined {
  const value = parent[key]
  if (value === undefined || value === null) return value
  if (!isPlainObject(value)) {
    throw new Error(`Invalid theme: '${key}' must be an object or null`)
  }
  return value
}

function readStr(obj: JsonRecord, key: string, fallback: string): string {
  const value = obj[key]
  if (value === undefined) return fallback
  if (typeof value !== "string") {
    throw new Error(`Invalid theme: '${key}' must be a string`)
  }
  return value
}

function readBool(obj: JsonRecord, key: string, fallback: boolean): boolean {
  const value = obj[key]
  if (value === undefined) return fallback
  if (typeof value !== "boolean") {
    throw new Error(`Invalid theme: '${key}' must be a boolean`)
  }
  return value
}

function readNum(
  obj: JsonRecord,
  key: string,
  fallback: number,
  positiveOnly = false,
): number {
  const value = obj[key]
  if (value === undefined) return fallback
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (positiveOnly && value <= 0)
  ) {
    throw new Error(`Invalid theme: '${key}' must be a valid number`)
  }
  return value
}

function readEnum<T extends string>(
  obj: JsonRecord,
  key: string,
  allowed: Set<string>,
  fallback: T,
): T {
  const value = obj[key]
  if (value === undefined) return fallback
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`Invalid theme: invalid '${key}' value`)
  }
  return value as T
}

function normalizeBackground(
  rawBg: JsonRecord,
  base: BroadcastTheme["background"],
): BroadcastTheme["background"] {
  const type = readEnum(rawBg, "type", BACKGROUND_TYPES, base.type)
  const color = readStr(rawBg, "color", base.color)

  const rawGradient = nullableObject(rawBg, "gradient")
  let gradient: BroadcastTheme["background"]["gradient"] = null
  if (rawGradient) {
    const rawStops = rawGradient.stops
    if (!Array.isArray(rawStops) || rawStops.length === 0) {
      throw new Error("Invalid theme: 'background.gradient.stops' must be a non-empty array")
    }
    const stops = rawStops.map((entry) => {
      if (!isPlainObject(entry)) {
        throw new Error("Invalid theme: invalid gradient stop")
      }
      return {
        color: readStr(entry, "color", "#000000"),
        position: readNum(entry, "position", 0),
      }
    })
    gradient = {
      type: readEnum(
        rawGradient,
        "type",
        GRADIENT_TYPES,
        base.gradient?.type ?? "linear",
      ),
      angle: readNum(rawGradient, "angle", base.gradient?.angle ?? 0),
      stops,
    }
  } else if (rawGradient === undefined && type === "gradient" && base.gradient) {
    gradient = {
      ...base.gradient,
      stops: base.gradient.stops.map((stop) => ({ ...stop })),
    }
  }

  const rawImage = nullableObject(rawBg, "image")
  let image: BroadcastTheme["background"]["image"] = null
  if (rawImage) {
    const url = readStr(rawImage, "url", "")
    const tint = rawImage.tint
    if (tint !== undefined && tint !== null && typeof tint !== "string") {
      throw new Error("Invalid theme: 'background.image.tint' must be a string or null")
    }
    image = {
      url,
      fit: readEnum(rawImage, "fit", IMAGE_FITS, "cover"),
      blur: readNum(rawImage, "blur", 0),
      brightness: readNum(rawImage, "brightness", 100),
      tint: tint ?? null,
    }
  }

  return { type, color, gradient, image }
}

function normalizeVerseText(
  rawText: JsonRecord,
  base: BroadcastTheme["verseText"],
): BroadcastTheme["verseText"] {
  const rawShadow = nullableObject(rawText, "shadow")
  const shadow = rawShadow
    ? {
        color: readStr(rawShadow, "color", "rgba(0,0,0,0.5)"),
        blur: readNum(rawShadow, "blur", 0),
        x: readNum(rawShadow, "x", 0),
        y: readNum(rawShadow, "y", 0),
      }
    : null

  const rawOutline = nullableObject(rawText, "outline")
  const outline = rawOutline
    ? {
        color: readStr(rawOutline, "color", "#000000"),
        width: readNum(rawOutline, "width", 1),
      }
    : null

  const fontStyle =
    rawText.fontStyle === undefined
      ? base.fontStyle
      : readEnum(rawText, "fontStyle", new Set(["normal", "italic"]), "normal")

  return {
    fontFamily: readStr(rawText, "fontFamily", base.fontFamily),
    ...(fontStyle ? { fontStyle } : {}),
    fontSize: readNum(rawText, "fontSize", base.fontSize, true),
    fontWeight: readNum(rawText, "fontWeight", base.fontWeight, true),
    color: readStr(rawText, "color", base.color),
    horizontalAlign: readEnum(
      rawText,
      "horizontalAlign",
      HORIZONTAL_ALIGNS,
      base.horizontalAlign ?? "center",
    ),
    verticalAlign: readEnum(
      rawText,
      "verticalAlign",
      VERTICAL_ALIGNS,
      base.verticalAlign ?? "top",
    ),
    textTransform: readEnum(
      rawText,
      "textTransform",
      TEXT_TRANSFORMS,
      base.textTransform ?? "none",
    ),
    textDecoration: readEnum(
      rawText,
      "textDecoration",
      TEXT_DECORATIONS,
      base.textDecoration ?? "none",
    ),
    lineHeight: readNum(rawText, "lineHeight", base.lineHeight, true),
    letterSpacing: readNum(rawText, "letterSpacing", base.letterSpacing),
    shadow,
    outline,
  }
}

function normalizeKinetic(
  rawKinetic: JsonRecord | undefined,
): BroadcastKineticTheme | undefined {
  if (!rawKinetic) return undefined
  if (
    !Array.isArray(rawKinetic.colors) ||
    rawKinetic.colors.some((c) => typeof c !== "string")
  ) {
    throw new Error("Invalid theme: 'kinetic.colors' must be a string array")
  }
  const motion = requireObject(rawKinetic, "motion")
  return {
    ...(rawKinetic as unknown as BroadcastKineticTheme),
    colors: [...rawKinetic.colors],
    accentColor: readStr(rawKinetic, "accentColor", "#ffffff"),
    motion: {
      durationMs: readNum(motion, "durationMs", 12000, true),
      driftAmount: readNum(motion, "driftAmount", 0.3),
      hueShiftDegrees: readNum(motion, "hueShiftDegrees", 0),
      saturationBoost: readNum(motion, "saturationBoost", 0),
    },
  }
}

export function validateAndNormalizeImportedTheme(raw: unknown): BroadcastTheme {
  if (!isPlainObject(raw)) {
    throw new Error("Invalid theme: expected a JSON object")
  }

  const name = readStr(raw, "name", "").trim()
  if (!name) {
    throw new Error("Invalid theme: missing 'name'")
  }

  const base = BUILTIN_THEMES[0]
  const rawResolution = requireObject(raw, "resolution")
  const resolution = {
    width: readNum(rawResolution, "width", 0, true),
    height: readNum(rawResolution, "height", 0, true),
  }

  const rawBackground = requireObject(raw, "background")
  const rawLayout = requireObject(raw, "layout")
  const rawVerseText = requireObject(raw, "verseText")
  const rawReference = requireObject(raw, "reference")
  const rawTextBox = optionalObject(raw, "textBox") ?? {}
  const rawVerseNumbers = optionalObject(raw, "verseNumbers") ?? {}
  const rawTransition = optionalObject(raw, "transition") ?? {}
  const rawPadding = optionalObject(rawLayout, "padding") ?? {}
  const rawKinetic = optionalObject(raw, "kinetic")
  const rawHymnPresentation = optionalObject(raw, "hymnPresentation")

  return {
    id: crypto.randomUUID(),
    name,
    builtin: false,
    pinned: readBool(raw, "pinned", false),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    resolution,
    background: normalizeBackground(rawBackground, base.background),
    textBox: {
      enabled: readBool(rawTextBox, "enabled", base.textBox.enabled),
      color: readStr(rawTextBox, "color", base.textBox.color),
      opacity: readNum(rawTextBox, "opacity", base.textBox.opacity),
      borderRadius: readNum(rawTextBox, "borderRadius", base.textBox.borderRadius),
      padding: readNum(rawTextBox, "padding", base.textBox.padding),
    },
    verseText: normalizeVerseText(rawVerseText, base.verseText),
    verseNumbers: {
      visible: readBool(rawVerseNumbers, "visible", base.verseNumbers.visible),
      fontSize: readNum(rawVerseNumbers, "fontSize", base.verseNumbers.fontSize, true),
      color: readStr(rawVerseNumbers, "color", base.verseNumbers.color),
      superscript: readBool(rawVerseNumbers, "superscript", base.verseNumbers.superscript),
    },
    reference: {
      fontFamily: readStr(rawReference, "fontFamily", base.reference.fontFamily),
      fontSize: readNum(rawReference, "fontSize", base.reference.fontSize, true),
      fontWeight: readNum(rawReference, "fontWeight", base.reference.fontWeight, true),
      color: readStr(rawReference, "color", base.reference.color),
      horizontalAlign: readEnum(
        rawReference,
        "horizontalAlign",
        HORIZONTAL_ALIGNS,
        base.reference.horizontalAlign ?? "center",
      ),
      verticalAlign: readEnum(
        rawReference,
        "verticalAlign",
        VERTICAL_ALIGNS,
        base.reference.verticalAlign ?? "top",
      ),
      textTransform: readEnum(
        rawReference,
        "textTransform",
        TEXT_TRANSFORMS,
        base.reference.textTransform ?? "none",
      ),
      textDecoration: readEnum(
        rawReference,
        "textDecoration",
        TEXT_DECORATIONS,
        base.reference.textDecoration ?? "none",
      ),
      uppercase: readBool(rawReference, "uppercase", base.reference.uppercase),
      letterSpacing: readNum(rawReference, "letterSpacing", base.reference.letterSpacing),
      position: readEnum(
        rawReference,
        "position",
        REFERENCE_POSITIONS,
        base.reference.position,
      ),
    },
    layout: {
      anchor: readEnum(rawLayout, "anchor", LAYOUT_ANCHORS, base.layout.anchor),
      offsetX: readNum(rawLayout, "offsetX", base.layout.offsetX),
      offsetY: readNum(rawLayout, "offsetY", base.layout.offsetY),
      padding: {
        top: readNum(rawPadding, "top", base.layout.padding.top),
        right: readNum(rawPadding, "right", base.layout.padding.right),
        bottom: readNum(rawPadding, "bottom", base.layout.padding.bottom),
        left: readNum(rawPadding, "left", base.layout.padding.left),
      },
      textAlign: readEnum(rawLayout, "textAlign", TEXT_ALIGNS, base.layout.textAlign),
      backgroundWidth: readNum(rawLayout, "backgroundWidth", base.layout.backgroundWidth, true),
      backgroundHeight: readNum(rawLayout, "backgroundHeight", base.layout.backgroundHeight, true),
      textAreaWidth: readNum(rawLayout, "textAreaWidth", base.layout.textAreaWidth, true),
      textAreaHeight: readNum(rawLayout, "textAreaHeight", base.layout.textAreaHeight, true),
      referenceGap: readNum(rawLayout, "referenceGap", base.layout.referenceGap ?? 32),
    },
    transition: {
      type: readEnum(rawTransition, "type", TRANSITION_TYPES, base.transition.type),
      duration: readNum(rawTransition, "duration", base.transition.duration),
      easing: readEnum(rawTransition, "easing", TRANSITION_EASINGS, base.transition.easing),
      direction: readEnum(rawTransition, "direction", TRANSITION_DIRECTIONS, base.transition.direction),
    },
    ...(rawKinetic ? { kinetic: normalizeKinetic(rawKinetic) } : {}),
    ...(rawHymnPresentation
      ? {
          hymnPresentation:
            rawHymnPresentation as unknown as BroadcastTheme["hymnPresentation"],
        }
      : {}),
  }
}

export async function pickThemeBackgroundImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
      },
    ],
  })
  if (!selected) return null

  const path = typeof selected === "string" ? selected : selected
  return await invokeTauri<string>("read_image_as_data_url", { path })
}

export async function exportTheme(theme: BroadcastTheme): Promise<void> {
  const path = await save({
    defaultPath: `${theme.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  })
  if (!path) return

  await invokeTauri("export_theme_to_path", { path, theme })
}

export async function importTheme(): Promise<BroadcastTheme | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Theme JSON", extensions: ["json"] }],
  })
  if (!selected) return null

  const path = typeof selected === "string" ? selected : selected
  const parsed = await invokeTauri<unknown>("import_theme_from_path", { path })
  return validateAndNormalizeImportedTheme(parsed)
}
