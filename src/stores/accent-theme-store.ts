import { create } from "zustand"

export type AccentTheme = "gold" | "emerald" | "purple" | "aurora"

const STORAGE_KEY = "sabbathcue-accent-theme"

function readStoredTheme(): AccentTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (
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
  return "gold"
}

interface AccentThemeState {
  theme: AccentTheme
  setTheme: (theme: AccentTheme) => void
  hydrate: () => void
}

export const useAccentThemeStore = create<AccentThemeState>((set) => ({
  theme: "gold",
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
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
