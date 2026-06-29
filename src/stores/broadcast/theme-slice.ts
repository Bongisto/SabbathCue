import { type StateCreator } from "zustand"
import type { BroadcastTheme, PresentationRenderData } from "@/types"
import { BUILTIN_THEMES, DEFAULT_HYMN_THEME_ID } from "@/lib/builtin-themes"
import type { BroadcastState } from "@/stores/broadcast-store"

export function findThemeById(
  themes: BroadcastTheme[],
  id: string
): BroadcastTheme | null {
  return themes.find((theme) => theme.id === id) ?? themes[0] ?? null
}

/**
 * The single hymn-scoping decision, shared by the projector output and every
 * in-app surface: a hymn item uses the dedicated hymn theme; anything else uses
 * the supplied base theme. Scripture/EGW/media are never affected.
 */
export function resolveThemeIdForItem(
  item: PresentationRenderData | null | undefined,
  baseThemeId: string,
  hymnThemeId: string
): string {
  return item?.kind === "hymn" && hymnThemeId ? hymnThemeId : baseThemeId
}

/** Theme an output should use, keyed off the live item (per-output base theme). */
export function resolveOutputThemeId(
  state: Pick<
    BroadcastState,
    "liveItem" | "activeThemeId" | "altActiveThemeId" | "hymnThemeId"
  >,
  outputId: string
): string {
  const base = outputId === "alt" ? state.altActiveThemeId : state.activeThemeId
  return resolveThemeIdForItem(state.liveItem, base, state.hymnThemeId)
}

export interface ThemeSlice {
  themes: BroadcastTheme[]
  activeThemeId: string
  altActiveThemeId: string
  hymnThemeId: string
  loadThemes: () => void
  saveTheme: (theme: BroadcastTheme) => void
  deleteTheme: (id: string) => void
  duplicateTheme: (id: string) => void
  createNewTheme: () => void
  renameTheme: (id: string, name: string) => void
  togglePinTheme: (id: string) => void
  setActiveTheme: (id: string) => void
  setAltActiveTheme: (id: string) => void
  setHymnTheme: (id: string) => void
}

export const createThemeSlice: StateCreator<
  BroadcastState,
  [],
  [],
  ThemeSlice
> = (set, get) => ({
  themes: [...BUILTIN_THEMES],
  activeThemeId: BUILTIN_THEMES[0].id,
  altActiveThemeId: BUILTIN_THEMES[0].id,
  hymnThemeId: DEFAULT_HYMN_THEME_ID,

  loadThemes: () => {
    set({ themes: [...BUILTIN_THEMES] })
  },
  saveTheme: (theme) =>
    set((s) => ({
      themes: s.themes.some((t) => t.id === theme.id)
        ? s.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...s.themes, theme],
    })),
  deleteTheme: (id) => {
    const { activeThemeId, altActiveThemeId, hymnThemeId, liveItem } = get()
    set((s) => {
      const themes = s.themes.filter((t) => t.id !== id || t.builtin)
      const fallbackId = themes[0]?.id ?? BUILTIN_THEMES[0].id
      return {
        themes,
        activeThemeId: s.activeThemeId === id ? fallbackId : s.activeThemeId,
        altActiveThemeId:
          s.altActiveThemeId === id ? fallbackId : s.altActiveThemeId,
        hymnThemeId:
          s.hymnThemeId === id ? DEFAULT_HYMN_THEME_ID : s.hymnThemeId,
      }
    })
    if (
      activeThemeId === id ||
      altActiveThemeId === id ||
      (hymnThemeId === id && liveItem?.kind === "hymn")
    ) {
      get().syncBroadcastOutput()
    }
  },
  duplicateTheme: (id) => {
    const s = get()
    const source = s.themes.find((t) => t.id === id)
    if (!source) return
    const newTheme: BroadcastTheme = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => ({ themes: [...s.themes, newTheme] }))
  },
  createNewTheme: () => {
    const source = BUILTIN_THEMES[0]
    const newTheme: BroadcastTheme = {
      ...source,
      id: crypto.randomUUID(),
      name: "Untitled Theme",
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      background: {
        type: "solid",
        color: "#000000",
        gradient: null,
        image: null,
      },
    }
    set((s) => ({ themes: [...s.themes, newTheme] }))
    get().startEditing(newTheme.id)
  },
  renameTheme: (id, name) =>
    set((s) => ({
      themes: s.themes.map((t) =>
        t.id === id && !t.builtin ? { ...t, name, updatedAt: Date.now() } : t
      ),
      draftTheme:
        s.draftTheme?.id === id
          ? { ...s.draftTheme, name, updatedAt: Date.now() }
          : s.draftTheme,
    })),
  togglePinTheme: (id) =>
    set((s) => ({
      themes: s.themes.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned, updatedAt: Date.now() } : t
      ),
    })),
  setActiveTheme: (activeThemeId) => {
    set({ activeThemeId })
    get().syncBroadcastOutputFor("main")
  },
  setAltActiveTheme: (altActiveThemeId) => {
    set({ altActiveThemeId })
    get().syncBroadcastOutputFor("alt")
  },
  setHymnTheme: (hymnThemeId) => {
    set({ hymnThemeId })
    if (get().liveItem?.kind === "hymn") get().syncBroadcastOutput()
  },
})
