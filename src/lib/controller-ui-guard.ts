import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/** Mixed outer shell stack removed in Step 1. */
export const MIXED_OUTER_SHELL_PATTERN =
  /glass-panel[\s\S]{0,120}(rounded-2xl|border-border|bg-card)|(rounded-2xl|border-border|bg-card)[\s\S]{0,120}glass-panel/

/** Shadcn surface tokens banned on controller workspace surfaces (Step 2). */
export const BANNED_SURFACE_TOKEN =
  /\b(bg-card(?:\/\d+)?|bg-muted(?!-foreground)(?:\/\d+)?|bg-background|bg-popover|border-border(?:\/\d+)?|border-input)\b/

export const LEGACY_CONTROLLER_CLASSES =
  /\b(btn-tactile|interactive-row|scrollbar-controller)\b/

export const LEGACY_DIALOG_CSS_PATTERN = /\.dark\s+\[data-slot="dialog/

export const CONTROLLER_WORKSPACE_ROOTS = [
  "src/components/layout",
  "src/components/panels",
  "src/components/hymnal",
  "src/components/service-plan",
  "src/components/tutorial",
  "src/components/settings-dialog.tsx",
  "src/components/broadcast/broadcast-settings.tsx",
  "src/components/verification/VerificationScreen.tsx",
  "src/App.tsx",
] as const

/** Theme designer / presentation internals — out of scope for Step 2 scans. */
export const OUT_OF_SCOPE_BROADCAST_FILES = new Set([
  "theme-designer.tsx",
  "design-canvas.tsx",
  "theme-library.tsx",
  "properties-panel.tsx",
])

/** Entire ui primitive tree owns shadcn tokens by design. */
export const PRIMITIVE_OWNED_PREFIX = "src/components/ui/"

const PRIMITIVE_JSX_PATTERN =
  /<(Input|Textarea|Select|Slider|Tabs|Command|Dialog|Popover|Tooltip)\b/

/** Native form tags must not use shadcn surface tokens in workspace files. */
export const NATIVE_FORM_SURFACE_PATTERN =
  /<(?:textarea|select)\b[\s\S]*\b(border-input|bg-background|border-border|bg-card)\b/i

/**
 * Lines that may retain primitive-owned tokens — only shared UI primitive JSX on the same line.
 * Native `<textarea>` / `<select>` and custom surfaces are never exempt.
 */
export function isPrimitiveOwnedLine(line: string): boolean {
  return PRIMITIVE_JSX_PATTERN.test(line)
}

export function scanNativeFormSurfaceTokens(
  repoRoot: string,
  files = listControllerWorkspaceFiles(repoRoot)
): ScanViolation[] {
  const violations: ScanViolation[] = []
  for (const file of files) {
    const content = readFileSync(join(repoRoot, file), "utf8")
    if (NATIVE_FORM_SURFACE_PATTERN.test(content)) {
      violations.push({
        file,
        line: 0,
        text: "native textarea/select uses banned shadcn surface tokens",
        rule: "native-form-surface",
      })
    }
  }
  return violations
}

export type ScanViolation = {
  file: string
  line: number
  text: string
  rule: string
}

function collectFiles(absoluteRoot: string, repoRoot: string): string[] {
  const rel = relative(repoRoot, absoluteRoot).replace(/\\/g, "/")
  if (rel.endsWith(".tsx") || rel.endsWith(".ts")) {
    return [rel]
  }

  const files: string[] = []
  for (const entry of readdirSync(absoluteRoot)) {
    const full = join(absoluteRoot, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      files.push(...collectFiles(full, repoRoot))
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      files.push(relative(repoRoot, full).replace(/\\/g, "/"))
    }
  }
  return files
}

export function listControllerWorkspaceFiles(repoRoot: string): string[] {
  return CONTROLLER_WORKSPACE_ROOTS.flatMap((root) => {
    const abs = join(repoRoot, root)
    return collectFiles(abs, repoRoot).filter((file) => {
      const base = file.split("/").pop() ?? file
      if (OUT_OF_SCOPE_BROADCAST_FILES.has(base)) return false
      if (file.startsWith(PRIMITIVE_OWNED_PREFIX)) return false
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return false
      return true
    })
  })
}

export function scanMixedOuterShell(
  repoRoot: string,
  files = listControllerWorkspaceFiles(repoRoot)
): ScanViolation[] {
  const violations: ScanViolation[] = []
  for (const file of files) {
    const content = readFileSync(join(repoRoot, file), "utf8")
    if (MIXED_OUTER_SHELL_PATTERN.test(content)) {
      violations.push({
        file,
        line: 0,
        text: "glass-panel combined with rounded-2xl, border-border, or bg-card",
        rule: "mixed-outer-shell",
      })
    }
  }
  return violations
}

export function scanBannedSurfaceTokens(
  repoRoot: string,
  files = listControllerWorkspaceFiles(repoRoot)
): ScanViolation[] {
  const violations: ScanViolation[] = []
  for (const file of files) {
    const lines = readFileSync(join(repoRoot, file), "utf8").split("\n")
    lines.forEach((text, index) => {
      if (!BANNED_SURFACE_TOKEN.test(text)) return
      if (isPrimitiveOwnedLine(text)) return
      violations.push({
        file,
        line: index + 1,
        text: text.trim(),
        rule: "banned-surface-token",
      })
    })
  }
  return violations
}

export function scanLegacyControllerClasses(
  repoRoot: string,
  files = listControllerWorkspaceFiles(repoRoot)
): ScanViolation[] {
  const violations: ScanViolation[] = []
  for (const file of files) {
    const lines = readFileSync(join(repoRoot, file), "utf8").split("\n")
    lines.forEach((text, index) => {
      if (LEGACY_CONTROLLER_CLASSES.test(text)) {
        violations.push({
          file,
          line: index + 1,
          text: text.trim(),
          rule: "legacy-controller-class",
        })
      }
    })
  }
  return violations
}

export function scanLegacyDialogCss(repoRoot: string): ScanViolation[] {
  const file = "src/index.css"
  const content = readFileSync(join(repoRoot, file), "utf8")
  if (!LEGACY_DIALOG_CSS_PATTERN.test(content)) return []
  return [
    {
      file,
      line: 0,
      text: "Legacy .dark [data-slot=dialog rules still present",
      rule: "legacy-dialog-css",
    },
  ]
}
