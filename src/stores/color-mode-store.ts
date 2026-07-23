import { create } from "zustand"

export type ColorMode = "light" | "dark"
export type DarkSurface = "charcoal" | "warm"

export const COLOR_MODE_STORAGE_KEY = "sabbathcue-color-mode"
export const DARK_SURFACE_STORAGE_KEY = "sabbathcue-dark-surface"

function isColorMode(value: string | null): value is ColorMode {
  return value === "light" || value === "dark"
}

function applyMode(mode: ColorMode) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.toggle("light", mode === "light")
  root.classList.toggle("dark", mode === "dark")
}

function readStoredMode(): ColorMode {
  try {
    const raw = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (isColorMode(raw)) return raw
  } catch {
    /* private browsing / disabled storage */
  }
  return "dark"
}

function readStoredDarkSurface(): DarkSurface {
  try {
    return localStorage.getItem(DARK_SURFACE_STORAGE_KEY) === "warm"
      ? "warm"
      : "charcoal"
  } catch {
    return "charcoal"
  }
}

interface ColorModeState {
  mode: ColorMode
  darkSurface: DarkSurface
  setMode: (mode: ColorMode) => void
  setDarkSurface: (surface: DarkSurface) => void
  toggle: () => void
  hydrate: () => void
}

export const useColorModeStore = create<ColorModeState>((set, get) => ({
  mode: "dark",
  darkSurface: "charcoal",
  setMode: (mode) => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    applyMode(mode)
    set({ mode })
  },
  setDarkSurface: (darkSurface) => {
    try {
      localStorage.setItem(DARK_SURFACE_STORAGE_KEY, darkSurface)
    } catch {
      /* ignore */
    }
    set({ darkSurface })
  },
  toggle: () => {
    get().setMode(get().mode === "dark" ? "light" : "dark")
  },
  hydrate: () => {
    const mode = readStoredMode()
    applyMode(mode)
    set({ mode, darkSurface: readStoredDarkSurface() })
  },
}))

export function darkSurfaceClassName(surface: DarkSurface): string {
  return `surface-${surface}`
}
