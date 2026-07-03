import { type StateCreator } from "zustand"
import type { BroadcastTheme } from "@/types"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import type { BroadcastState } from "@/stores/broadcast-store"

export function findThemeById(
  themes: BroadcastTheme[],
  id: string
): BroadcastTheme | null {
  return themes.find((theme) => theme.id === id) ?? themes[0] ?? null
}

/** Theme an output should use (per-output base theme). */
export function resolveOutputThemeId(
  state: Pick<BroadcastState, "activeThemeId" | "altActiveThemeId">,
  outputId: string
): string {
  return outputId === "alt" ? state.altActiveThemeId : state.activeThemeId
}

export interface ThemeSlice {
  themes: BroadcastTheme[]
  activeThemeId: string
  altActiveThemeId: string
  loadThemes: () => void
  saveTheme: (theme: BroadcastTheme) => void
  deleteTheme: (id: string) => void
  duplicateTheme: (id: string) => void
  createNewTheme: () => void
  renameTheme: (id: string, name: string) => void
  togglePinTheme: (id: string) => void
  setActiveTheme: (id: string) => void
  setAltActiveTheme: (id: string) => void
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
    const target = get().themes.find((t) => t.id === id)
    if (!target || target.builtin) return

    const { activeThemeId, altActiveThemeId } = get()
    set((s) => {
      const themes = s.themes.filter((t) => t.id !== id)
      const fallbackTheme = themes[0] ?? BUILTIN_THEMES[0]
      const fallbackId = fallbackTheme.id
      const deletedEditedTheme =
        s.editingThemeId === id || s.draftTheme?.id === id
      return {
        themes,
        activeThemeId: s.activeThemeId === id ? fallbackId : s.activeThemeId,
        altActiveThemeId:
          s.altActiveThemeId === id ? fallbackId : s.altActiveThemeId,
        editingThemeId: deletedEditedTheme ? fallbackId : s.editingThemeId,
        draftTheme: deletedEditedTheme
          ? { ...fallbackTheme, updatedAt: Date.now() }
          : s.draftTheme,
        selectedElement: deletedEditedTheme ? null : s.selectedElement,
        renamingThemeId: s.renamingThemeId === id ? null : s.renamingThemeId,
      }
    })
    if (activeThemeId === id || altActiveThemeId === id) {
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
})
