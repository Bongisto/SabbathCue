import { create } from "zustand"

export type AccentTheme = "teal" | "gold" | "emerald" | "purple" | "aurora"

export const ACCENT_THEME_STORAGE_KEY = "sabbathcue-accent-theme"

function readStoredTheme(): AccentTheme {
  try {
    const raw = localStorage.getItem(ACCENT_THEME_STORAGE_KEY)
    if (
      raw === "teal" ||
      raw === "gold" ||
      raw === "emerald" ||
      raw === "purple" ||
      raw === "aurora"
    ) {
      return raw
    }
  } catch {
    /* private browsing / disabled storage */
  }
  return "teal"
}

interface AccentThemeState {
  theme: AccentTheme
  setTheme: (theme: AccentTheme) => void
  hydrate: () => void
}

export const useAccentThemeStore = create<AccentThemeState>((set) => ({
  theme: "teal",
  setTheme: (theme) => {
    try {
      localStorage.setItem(ACCENT_THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },
  hydrate: () => set({ theme: readStoredTheme() }),
}))

export function accentThemeClassName(theme: AccentTheme): string {
  return `theme-${theme}`
}
