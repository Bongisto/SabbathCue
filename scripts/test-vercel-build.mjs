import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

execFileSync(process.execPath, [join(repoRoot, "scripts", "vercel-build.mjs")], {
  cwd: repoRoot,
  stdio: "inherit",
})

const sourceHtml = join(repoRoot, "landing", "index.html")
const outputHtml = join(repoRoot, "dist", "index.html")
assert.equal(readFileSync(outputHtml, "utf8"), readFileSync(sourceHtml, "utf8"))

for (const asset of ["sabbathcue-demo.mp4", "afrikaans-live-test.mp4"]) {
  const source = join(repoRoot, "landing", "assets", asset)
  const output = join(repoRoot, "dist", "assets", asset)
  assert.ok(existsSync(output), `dist/assets/${asset} must exist`)
  assert.equal(statSync(output).size, statSync(source).size)
}

console.log("[test-vercel-build] Static landing artifact verified")
