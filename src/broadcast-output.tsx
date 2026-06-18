import { createRoot } from "react-dom/client"
import { useEffect, useState } from "react"
import "@/index.css"
import { useBroadcastOutputRuntime } from "@/hooks/use-broadcast-output-runtime"
import {
  ACCENT_THEME_STORAGE_KEY,
  accentThemeClassName,
  type AccentTheme,
} from "@/stores/accent-theme-store"

function readAccentTheme(): AccentTheme {
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
    /* ignore */
  }
  return "teal"
}

function applyAccentThemeToDocument() {
  const theme = readAccentTheme()
  const root = document.documentElement
  root.id = "bodyThemeContainer"
  root.className = `dark ${accentThemeClassName(theme)}`
  document.body.style.margin = "0"
  document.body.style.background = "var(--bg-deep)"
}

/** Read output ID from URL query param (?output=main or ?output=alt). Defaults to "main". */
const outputId =
  new URLSearchParams(window.location.search).get("output") ?? "main"

function BroadcastCanvas() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  useBroadcastOutputRuntime({ canvas, outputId })

  useEffect(() => {
    applyAccentThemeToDocument()
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCENT_THEME_STORAGE_KEY) {
        applyAccentThemeToDocument()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return (
    <canvas
      ref={setCanvas}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        background: "#000",
        objectFit: "contain",
      }}
    />
  )
}

applyAccentThemeToDocument()

const root = document.getElementById("broadcast-root")!
createRoot(root).render(<BroadcastCanvas />)
