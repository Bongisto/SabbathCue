import { useState } from "react"
import { useBroadcastDesignerStore as useBroadcastStore } from "@/stores/broadcast/designer-store"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FONT_FAMILY_GROUPS } from "@/lib/fonts"

const FONT_WEIGHTS = [
  { value: "100", label: "100 - Thin" },
  { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" },
  { value: "400", label: "400 - Regular" },
  { value: "500", label: "500 - Medium" },
  { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" },
  { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
]

const FONT_STYLES = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
] as const

const HORIZONTAL_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
] as const

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
] as const

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
] as const

const TEXT_DECORATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "underline", label: "Underline" },
  { value: "line-through", label: "Line Through" },
] as const

const HEX_6_RE = /^#([0-9a-f]{6})$/i
const HEX_8_RE = /^#([0-9a-f]{6})([0-9a-f]{2})$/i
const HEX_3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX_4_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i
const RGB_RE =
  /^rgba?\(\s*([+-]?\d*\.?\d+%?)\s*(?:,\s*|\s+)([+-]?\d*\.?\d+%?)\s*(?:,\s*|\s+)([+-]?\d*\.?\d+%?)\s*(?:(?:,|\/)\s*([+-]?\d*\.?\d+%?)\s*)?\)$/i

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toHexByte(value: number): string {
  return Math.round(clampNumber(value, 0, 255))
    .toString(16)
    .padStart(2, "0")
}

function parseRgbChannel(raw: string): number | null {
  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1))
    if (!Number.isFinite(pct)) return null
    return clampNumber((pct / 100) * 255, 0, 255)
  }
  const num = Number(raw)
  if (!Number.isFinite(num)) return null
  return clampNumber(num, 0, 255)
}

function parseAlphaChannel(raw: string): number | null {
  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1))
    if (!Number.isFinite(pct)) return null
    return Math.round(clampNumber(pct, 0, 100))
  }
  const num = Number(raw)
  if (!Number.isFinite(num)) return null
  return Math.round(clampNumber(num, 0, 1) * 100)
}

export function parseColorOpacity(
  color: string,
  fallbackHex = "#000000"
): { hex: string; opacity: number } {
  const trimmed = color.trim()
  if (trimmed.toLowerCase() === "transparent") {
    return { hex: "#000000", opacity: 0 }
  }

  const hex8 = HEX_8_RE.exec(trimmed)
  if (hex8) {
    const alpha = parseInt(hex8[2], 16) / 255
    return {
      hex: `#${hex8[1].toLowerCase()}`,
      opacity: Math.round(clampNumber(alpha, 0, 1) * 100),
    }
  }

  const hex6 = HEX_6_RE.exec(trimmed)
  if (hex6) {
    return { hex: `#${hex6[1].toLowerCase()}`, opacity: 100 }
  }

  const hex4 = HEX_4_RE.exec(trimmed)
  if (hex4) {
    const hex = `#${hex4[1]}${hex4[1]}${hex4[2]}${hex4[2]}${hex4[3]}${hex4[3]}`.toLowerCase()
    const alpha = parseInt(`${hex4[4]}${hex4[4]}`, 16) / 255
    return { hex, opacity: Math.round(clampNumber(alpha, 0, 1) * 100) }
  }

  const hex3 = HEX_3_RE.exec(trimmed)
  if (hex3) {
    const hex = `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`.toLowerCase()
    return { hex, opacity: 100 }
  }

  const rgb = RGB_RE.exec(trimmed)
  if (rgb) {
    const r = parseRgbChannel(rgb[1])
    const g = parseRgbChannel(rgb[2])
    const b = parseRgbChannel(rgb[3])
    const opacity = rgb[4] !== undefined ? parseAlphaChannel(rgb[4]) : 100
    if (r !== null && g !== null && b !== null && opacity !== null) {
      return {
        hex: `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`,
        opacity,
      }
    }
  }

  const fallbackMatch = HEX_6_RE.exec(fallbackHex.trim())
  return {
    hex: fallbackMatch ? `#${fallbackMatch[1].toLowerCase()}` : "#000000",
    opacity: 100,
  }
}

export function buildColorWithOpacity(color: string, opacity: number): string {
  const { hex } = parseColorOpacity(color)
  const clampedOpacity = Math.round(
    clampNumber(Number.isFinite(opacity) ? opacity : 100, 0, 100)
  )
  if (clampedOpacity >= 100) return hex
  const alphaHex = Math.round((clampedOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${alphaHex}`
}

export function HexColorInput({
  value,
  onCommit,
  className,
}: {
  value: string
  onCommit: (hex: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    if (draft !== null && draft.trim().toLowerCase() !== value.toLowerCase()) {
      setDraft(null)
    }
  }

  const displayedValue = draft ?? value

  return (
    <Input
      value={displayedValue}
      onFocus={() => setDraft(value)}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        const trimmed = next.trim()
        if (HEX_6_RE.test(trimmed)) {
          onCommit(trimmed.toLowerCase())
        }
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          setDraft(null)
          e.currentTarget.blur()
        } else if (e.key === "Enter") {
          e.currentTarget.blur()
        }
      }}
      className={className}
    />
  )
}

export function BoundedNumberInput({
  value,
  min,
  max,
  onCommit,
  className,
}: {
  value: number
  min: number
  max: number
  onCommit: (next: number) => void
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    const trimmed = draft?.trim() ?? ""
    if (draft !== null && (trimmed === "" || Number(trimmed) !== value)) {
      setDraft(null)
    }
  }

  const displayedValue = draft ?? String(value)

  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={displayedValue}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        const trimmed = next.trim()
        if (trimmed === "") return
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          onCommit(parsed)
        }
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          setDraft(null)
          e.currentTarget.blur()
        } else if (e.key === "Enter") {
          e.currentTarget.blur()
        }
      }}
      className={className}
    />
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5 pb-1">
      <h4 className="text-xs font-semibold">{title}</h4>
      <p className="text-[11px] text-muted-foreground">{description}</p>
    </div>
  )
}

function FontControls({ prefix }: { prefix: "verseText" | "reference" }) {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const data = prefix === "verseText" ? draftTheme.verseText : draftTheme.reference
  const { hex: colorHex, opacity: colorOpacity } = parseColorOpacity(data.color, "#ffffff")
  const horizontalAlign = data.horizontalAlign ?? draftTheme.layout.textAlign
  const verticalAlign = data.verticalAlign ?? "top"
  const textTransform = data.textTransform ?? "none"
  const textDecoration = data.textDecoration ?? "none"

  return (
    <div className="flex flex-col gap-3">
      {/* Font Family */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Font Family</label>
        <Select
          value={data.fontFamily}
          onValueChange={(v) => update(`${prefix}.fontFamily`, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILY_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.families.map((f) => (
                  // Preview each option in its own face so the operator picks
                  // by how it looks, not by name recall.
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {prefix === "verseText" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Font Style</label>
          <Select
            value={draftTheme.verseText.fontStyle ?? "normal"}
            onValueChange={(v) => update("verseText.fontStyle", v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Font Weight */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Font Weight</label>
        <Select
          value={String(data.fontWeight)}
          onValueChange={(v) => update(`${prefix}.fontWeight`, Number(v))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_WEIGHTS.map((w) => (
              <SelectItem key={w.value} value={w.value}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Font Size</label>
          <span className="text-xs tabular-nums text-muted-foreground">{data.fontSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <Slider
            min={8}
            max={200}
            step={1}
            value={[data.fontSize]}
            onValueChange={([v]) => update(`${prefix}.fontSize`, v)}
            className="flex-1"
          />
          <BoundedNumberInput
            min={8}
            max={200}
            value={data.fontSize}
            onCommit={(v) => update(`${prefix}.fontSize`, v)}
            className="w-16"
          />
        </div>
      </div>

      {/* Line Height — only for verse text, reference type doesn't have lineHeight */}
      {prefix === "verseText" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Line Height</label>
            <span className="text-xs tabular-nums text-muted-foreground">{(draftTheme.verseText.lineHeight).toFixed(2)}</span>
          </div>
          <Slider
            min={0.5}
            max={3.0}
            step={0.05}
            value={[draftTheme.verseText.lineHeight]}
            onValueChange={([v]) => update("verseText.lineHeight", v)}
          />
        </div>
      )}

      {/* Letter Spacing */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Letter Spacing</label>
          <span className="text-xs tabular-nums text-muted-foreground">{data.letterSpacing}px</span>
        </div>
        <Slider
          min={-5}
          max={50}
          step={0.5}
          value={[data.letterSpacing]}
          onValueChange={([v]) => update(`${prefix}.letterSpacing`, v)}
        />
      </div>

      {/* Horizontal Alignment */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Horizontal Alignment</label>
        <Select
          value={horizontalAlign}
          onValueChange={(v) => update(`${prefix}.horizontalAlign`, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HORIZONTAL_ALIGN_OPTIONS
              .filter((option) => prefix === "verseText" || option.value !== "justify")
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vertical Alignment */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Vertical Alignment</label>
        <Select
          value={verticalAlign}
          onValueChange={(v) => update(`${prefix}.verticalAlign`, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERTICAL_ALIGN_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text Transform */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Text Transform</label>
        <Select
          value={textTransform}
          onValueChange={(v) => update(`${prefix}.textTransform`, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_TRANSFORM_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text Decoration */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Text Decoration</label>
        <Select
          value={textDecoration}
          onValueChange={(v) => update(`${prefix}.textDecoration`, v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_DECORATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Text Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorHex}
            onChange={(e) =>
              update(`${prefix}.color`, buildColorWithOpacity(e.target.value, colorOpacity))
            }
            className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <HexColorInput
            value={colorHex}
            onCommit={(v) =>
              update(`${prefix}.color`, buildColorWithOpacity(v, colorOpacity))
            }
            className="w-20 font-mono"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Opacity</label>
          <span className="text-xs tabular-nums text-muted-foreground">{colorOpacity}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[colorOpacity]}
          onValueChange={([v]) =>
            update(`${prefix}.color`, buildColorWithOpacity(colorHex, v))
          }
        />
      </div>
    </div>
  )
}

function ReferenceProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Reference Text" description="Customize how reference text appears" />
      <FontControls prefix="reference" />

      {/* Uppercase */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Uppercase</label>
        <input
          type="checkbox"
          checked={draftTheme.reference.uppercase}
          onChange={(e) => update("reference.uppercase", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </div>

      {/* Reference Position */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Reference Position</label>
        <Select
          value={draftTheme.reference.position}
          onValueChange={(v) => update("reference.position", v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Above Verse</SelectItem>
            <SelectItem value="below">Below Verse</SelectItem>
            <SelectItem value="inline">Inline</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function VerseProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const shadow = draftTheme.verseText.shadow
  const outline = draftTheme.verseText.outline

  const shadowColor = shadow ? parseColorOpacity(shadow.color) : { hex: "#000000", opacity: 100 }
  const outlineColor = outline ? parseColorOpacity(outline.color) : { hex: "#000000", opacity: 100 }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Verse Text" description="Customize how verse text appears" />
      <FontControls prefix="verseText" />

      {/* Text Shadow */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold">Text Shadow</label>
          <input
            type="checkbox"
            checked={shadow !== null}
            onChange={(e) => {
              if (e.target.checked) {
                update("verseText.shadow", { color: "#00000080", blur: 4, x: 2, y: 2 })
              } else {
                update("verseText.shadow", null)
              }
            }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
        </div>

        {shadow && (
          <div className="flex flex-col gap-3">
            {/* Offset X */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Offset X</label>
                <span className="text-xs tabular-nums text-muted-foreground">{shadow.x}px</span>
              </div>
              <Slider
                min={-20}
                max={50}
                step={1}
                value={[shadow.x]}
                onValueChange={([v]) => update("verseText.shadow.x", v)}
              />
            </div>

            {/* Offset Y */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Offset Y</label>
                <span className="text-xs tabular-nums text-muted-foreground">{shadow.y}px</span>
              </div>
              <Slider
                min={-20}
                max={50}
                step={1}
                value={[shadow.y]}
                onValueChange={([v]) => update("verseText.shadow.y", v)}
              />
            </div>

            {/* Blur */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Blur</label>
                <span className="text-xs tabular-nums text-muted-foreground">{shadow.blur}px</span>
              </div>
              <Slider
                min={0}
                max={50}
                step={1}
                value={[shadow.blur]}
                onValueChange={([v]) => update("verseText.shadow.blur", v)}
              />
            </div>

            {/* Shadow Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Shadow Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={shadowColor.hex}
                  onChange={(e) =>
                    update(
                      "verseText.shadow.color",
                      buildColorWithOpacity(e.target.value, shadowColor.opacity)
                    )
                  }
                  className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <HexColorInput
                  value={shadowColor.hex}
                  onCommit={(v) =>
                    update(
                      "verseText.shadow.color",
                      buildColorWithOpacity(v, shadowColor.opacity)
                    )
                  }
                  className="w-20 font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Opacity</label>
                <span className="text-xs tabular-nums text-muted-foreground">{shadowColor.opacity}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[shadowColor.opacity]}
                onValueChange={([v]) =>
                  update(
                    "verseText.shadow.color",
                    buildColorWithOpacity(shadowColor.hex, v)
                  )
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Text Outline */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold">Text Outline</label>
          <input
            type="checkbox"
            checked={outline !== null}
            onChange={(e) => {
              if (e.target.checked) {
                update("verseText.outline", { color: "#000000", width: 1 })
              } else {
                update("verseText.outline", null)
              }
            }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
        </div>

        {outline && (
          <div className="flex flex-col gap-3">
            {/* Width */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Width</label>
                <span className="text-xs tabular-nums text-muted-foreground">{outline.width}px</span>
              </div>
              <Slider
                min={0}
                max={20}
                step={0.5}
                value={[outline.width]}
                onValueChange={([v]) => update("verseText.outline.width", v)}
              />
            </div>

            {/* Outline Color */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Outline Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={outlineColor.hex}
                  onChange={(e) => update("verseText.outline.color", e.target.value)}
                  className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <HexColorInput
                  value={outlineColor.hex}
                  onCommit={(v) => update("verseText.outline.color", v)}
                  className="w-20 font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function TextProperties() {
  const selectedElement = useBroadcastStore((s) => s.selectedElement)

  if (selectedElement === "reference") {
    return <ReferenceProperties />
  }

  if (selectedElement === "verse") {
    return <VerseProperties />
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">No element selected</p>
      <p className="text-xs text-muted-foreground">
        Click on verse, reference, or translation text in the canvas to edit its properties
      </p>
    </div>
  )
}
