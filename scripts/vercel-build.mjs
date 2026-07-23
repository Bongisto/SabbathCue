import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const landingRoot = join(repoRoot, "landing")
const outputRoot = join(repoRoot, "dist")

if (!existsSync(join(landingRoot, "index.html"))) {
  throw new Error("landing/index.html is required for the Vercel static build")
}

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
cpSync(join(landingRoot, "index.html"), join(outputRoot, "index.html"))

const landingAssets = join(landingRoot, "assets")
if (existsSync(landingAssets)) {
  cpSync(landingAssets, join(outputRoot, "assets"), { recursive: true })
}

console.log("[vercel-build] Published landing/ to dist/")
