import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const landingRoot = join(repoRoot, "landing")
const webRoot = join(repoRoot, "web")
const webOut = join(webRoot, "out")
const outputRoot = join(repoRoot, "dist")

if (!existsSync(join(landingRoot, "index.html"))) {
  throw new Error("landing/index.html is required for the Vercel static build")
}

if (!existsSync(join(webRoot, "package.json"))) {
  throw new Error("web/package.json is required for the Vercel checkout build")
}

const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() ||
  "https://sabbath-cue-two.vercel.app"

console.log("[vercel-build] Building Next.js checkout routes (basePath=/)…")
execFileSync(process.execPath, ["scripts/build.mjs"], {
  cwd: webRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_BASE_PATH: "",
    NEXT_PUBLIC_SITE_ORIGIN: siteOrigin,
  },
})

if (!existsSync(webOut)) {
  throw new Error("web/out missing after Next.js build")
}

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })

console.log("[vercel-build] Copying Next.js export to dist/…")
cpSync(webOut, outputRoot, { recursive: true })

console.log("[vercel-build] Overwriting dist/index.html with landing/ homepage…")
cpSync(join(landingRoot, "index.html"), join(outputRoot, "index.html"))

const landingAssets = join(landingRoot, "assets")
if (existsSync(landingAssets)) {
  cpSync(landingAssets, join(outputRoot, "assets"), { recursive: true })
}

console.log(
  `[vercel-build] Done. Homepage: landing/. Checkout: ${siteOrigin}/pricing/ and ${siteOrigin}/pay/`
)
