/**
 * Downloads the Whisper tiny.en GGML model for local speech-to-text.
 *
 * Model: ggml-tiny.en.bin (~75MB)
 * Source: https://huggingface.co/ggerganov/whisper.cpp
 *
 * Run: bun run download:whisper
 */

import { join } from "node:path"
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs"

const PROJECT_ROOT = join(import.meta.dir, "..")
const MODELS_DIR = join(PROJECT_ROOT, "models", "whisper")
const MODEL_FILE = "ggml-tiny.en.bin"
const MODEL_PATH = join(MODELS_DIR, MODEL_FILE)
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`
const TMP_MODEL_PATH = `${MODEL_PATH}.tmp`
const MAX_ATTEMPTS = 5

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getHeaders() {
  const token = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN
  if (!token) return undefined

  return {
    Authorization: `Bearer ${token}`,
  }
}

async function fetchWithRetry(url: string) {
  const headers = getHeaders()

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
    })

    if (response.ok) {
      return response
    }

    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const retryAfterHeader = response.headers.get("retry-after")
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1_000 : NaN
    const backoffMs = Number.isFinite(retryAfterMs)
      ? retryAfterMs
      : Math.min(30_000, 2_000 * 2 ** (attempt - 1))

    console.warn(
      `Download attempt ${attempt} failed with ${response.status}. Retrying in ${Math.round(backoffMs / 1_000)}s...`
    )
    await sleep(backoffMs)
  }

  throw new Error("Download failed after retries")
}

async function main() {
  if (existsSync(MODEL_PATH)) {
    console.log(`Whisper model already exists: ${MODEL_PATH}`)
    return
  }

  mkdirSync(MODELS_DIR, { recursive: true })

  console.log(`Downloading Whisper model from ${MODEL_URL}`)
  console.log(`Destination: ${MODEL_PATH}`)
  if (getHeaders()) {
    console.log("Using Hugging Face token from environment.")
  }

  const response = await fetchWithRetry(MODEL_URL)

  const totalBytes = Number(response.headers.get("content-length") ?? 0)
  const totalMB = (totalBytes / 1_000_000).toFixed(0)
  console.log(`Size: ${totalMB} MB`)

  rmSync(TMP_MODEL_PATH, { force: true })

  const writer = createWriteStream(TMP_MODEL_PATH)
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  let downloaded = 0
  let lastPercent = -1

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writer.write(Buffer.from(value))
    downloaded += value.byteLength

    const percent = totalBytes > 0 ? Math.floor((downloaded / totalBytes) * 100) : 0
    if (percent !== lastPercent && percent % 5 === 0) {
      process.stdout.write(`\r  ${percent}% (${(downloaded / 1_000_000).toFixed(0)}/${totalMB} MB)`)
      lastPercent = percent
    }
  }

  writer.end()
  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve)
    writer.on("error", reject)
  })

  // Atomic rename
  renameSync(TMP_MODEL_PATH, MODEL_PATH)

  console.log(`\nWhisper model downloaded: ${MODEL_PATH}`)
}

main().catch((e) => {
  console.error("Failed to download Whisper model:", e)
  process.exit(1)
})
