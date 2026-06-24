import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

const previewBaseUrl = "http://127.0.0.1:3000"
const broadcastEntryUrl = `${previewBaseUrl}/broadcast-output.html?output=main&e2e=1`
const usesExternalServer = process.env.SABBATHCUE_E2E_EXTERNAL_SERVER === "1"
const localChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const browserChannel =
  process.env.SABBATHCUE_E2E_BROWSER_CHANNEL ??
  (process.platform === "win32" && existsSync(localChromePath) ? "chrome" : undefined)

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // Browser e2e occasionally races a cold/contended CI runner (slow chunk load
  // delays the React mount). Retry transient failures on CI; never locally.
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: previewBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run build && npx vite preview --host 127.0.0.1 --port 3000",
        url: broadcastEntryUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
})
