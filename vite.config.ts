import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        broadcast: path.resolve(__dirname, "broadcast-output.html"),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")
          if (!normalizedId.includes("node_modules")) return
          if (normalizedId.includes("fabric")) return "canvas"
          if (normalizedId.includes("fuse.js")) return "search"
          if (
            normalizedId.includes("react-joyride") ||
            normalizedId.includes("@gilbarbara") ||
            normalizedId.includes("@fastify/deepmerge") ||
            normalizedId.includes("react-innertext") ||
            normalizedId.includes("/node_modules/scroll/") ||
            normalizedId.includes("/node_modules/scrollparent/") ||
            normalizedId.includes("/node_modules/is-lite/")
          ) {
            return "tour"
          }
          if (normalizedId.includes("lucide-react")) return "icons"
          if (normalizedId.includes("@radix-ui/react-dialog")) return "dialog"
          if (
            normalizedId.includes("@radix-ui") ||
            normalizedId.includes("radix-ui") ||
            normalizedId.includes("cmdk")
          ) {
            return "ui"
          }
          // Split the previously-monolithic `vendor` chunk (PERF-001 / R1).
          // Path-anchored matches avoid catching e.g. `react-*` packages already
          // routed above (tour/icons/ui).
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "react"
          }
          if (normalizedId.includes("/node_modules/@supabase/")) return "supabase"
          if (normalizedId.includes("/node_modules/@tauri-apps/")) return "tauri"
          if (normalizedId.includes("/node_modules/zustand/")) return "state"
          return "vendor"
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
