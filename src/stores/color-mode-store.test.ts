import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COLOR_MODE_STORAGE_KEY,
  DARK_SURFACE_STORAGE_KEY,
  useColorModeStore,
  type ColorMode,
} from "./color-mode-store"

function makeClassList() {
  const classes = new Set<string>()
  return {
    contains: (name: string) => classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const shouldAdd = force ?? !classes.has(name)
      if (shouldAdd) classes.add(name)
      else classes.delete(name)
      return shouldAdd
    },
    clear: () => classes.clear(),
  }
}

const classList = makeClassList()
const storage = new Map<string, string>()

function resetStore(mode: ColorMode = "dark") {
  classList.clear()
  storage.clear()
  vi.stubGlobal("document", {
    documentElement: {
      classList,
    },
  })
  vi.stubGlobal("localStorage", {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  useColorModeStore.setState({
    mode,
    darkSurface: "charcoal",
  })
}

describe("color mode store", () => {
  beforeEach(() => {
    resetStore()
  })

  it("hydrates to dark by default", () => {
    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("dark")
    expect(classList.contains("dark")).toBe(true)
    expect(classList.contains("light")).toBe(false)
  })

  it("sets and persists light mode", () => {
    useColorModeStore.getState().setMode("light")

    expect(storage.get(COLOR_MODE_STORAGE_KEY)).toBe("light")
    expect(useColorModeStore.getState().mode).toBe("light")
    expect(classList.contains("light")).toBe(true)
    expect(classList.contains("dark")).toBe(false)
  })

  it("toggles between dark and light", () => {
    useColorModeStore.getState().hydrate()

    useColorModeStore.getState().toggle()
    expect(useColorModeStore.getState().mode).toBe("light")

    useColorModeStore.getState().toggle()
    expect(useColorModeStore.getState().mode).toBe("dark")
  })

  it("hydrates a persisted mode", () => {
    storage.set(COLOR_MODE_STORAGE_KEY, "light")

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(classList.contains("light")).toBe(true)
  })

  it("persists one mutually exclusive dark surface", () => {
    useColorModeStore.getState().setDarkSurface("warm")
    expect(useColorModeStore.getState().darkSurface).toBe("warm")
    expect(storage.get(DARK_SURFACE_STORAGE_KEY)).toBe("warm")

    useColorModeStore.getState().setDarkSurface("charcoal")
    expect(useColorModeStore.getState().darkSurface).toBe("charcoal")
    expect(storage.get(DARK_SURFACE_STORAGE_KEY)).toBe("charcoal")
  })

  it("hydrates the warm surface independently of color mode", () => {
    storage.set(COLOR_MODE_STORAGE_KEY, "dark")
    storage.set(DARK_SURFACE_STORAGE_KEY, "warm")

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState()).toMatchObject({
      mode: "dark",
      darkSurface: "warm",
    })
  })

  it("falls back to dark when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled")
      },
      setItem: () => undefined,
    })

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("dark")
    expect(classList.contains("dark")).toBe(true)
  })
})
