/**
 * Downloads the Whisper tiny English ggml model used by CI and release builds.
 *
 * Run: bun run download:whisper
 */

import { existsSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin"
const MODEL_DIR = join(__dirname, "..", "models", "whisper")
const MODEL_PATH = join(MODEL_DIR, "ggml-tiny.en.bin")
const TEMP_MODEL_PATH = `${MODEL_PATH}.tmp`
const EXPECTED_SIZE_BYTES = 77_704_715
const MAX_ATTEMPTS = 3

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function isTransientDownloadError(error) {
  const code = error?.cause?.code ?? error?.code
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "UND_ERR_SOCKET"
  )
}

export async function withTransientRetries(
  fn,
  { attempts = MAX_ATTEMPTS, delayMs = 1000 } = {},
) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isTransientDownloadError(error)) {
        throw error
      }
      const waitMs = delayMs * attempt
      const code = error?.cause?.code ?? error?.code ?? error.message
      console.warn(
        `  Download attempt ${attempt} failed (${code}); retrying in ${waitMs}ms`,
      )
      await new Promise((resolveWait) => setTimeout(resolveWait, waitMs))
    }
  }
  throw lastError
}

async function existingModelIsValid() {
  if (!existsSync(MODEL_PATH)) return false

  const file = await import("node:fs/promises").then((fs) =>
    fs.stat(MODEL_PATH)
  )
  return file.size === EXPECTED_SIZE_BYTES
}

async function downloadModel() {
  await mkdir(MODEL_DIR, { recursive: true })
  await rm(TEMP_MODEL_PATH, { force: true })

  const response = await fetch(MODEL_URL, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${MODEL_URL}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength !== EXPECTED_SIZE_BYTES) {
    throw new Error(
      `Downloaded Whisper model has unexpected size ${formatMB(
        buffer.byteLength
      )}; expected ${formatMB(EXPECTED_SIZE_BYTES)}`
    )
  }

  await writeFile(TEMP_MODEL_PATH, buffer)
  await rename(TEMP_MODEL_PATH, MODEL_PATH)
}

async function main() {
  console.log("\n=== Downloading Whisper tiny English model ===\n")

  if (await existingModelIsValid()) {
    console.log(
      `  Whisper model already present: ${MODEL_PATH} (${formatMB(
        EXPECTED_SIZE_BYTES
      )})`
    )
    return
  }

  console.log(`  Downloading ${MODEL_URL}`)
  await withTransientRetries(downloadModel)
  console.log(`  Saved ${MODEL_PATH} (${formatMB(EXPECTED_SIZE_BYTES)})`)
}

function isMainModule() {
  return (
    process.argv[1] != null &&
    resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  )
}

if (isMainModule()) {
  main().catch(async (error) => {
    await rm(TEMP_MODEL_PATH, { force: true })
    console.error("Download failed:", error)
    process.exit(1)
  })
}
