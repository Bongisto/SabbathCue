import path from "path"
import { defineConfig, configDefaults } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 20000,
  },
})
