import assert from "node:assert/strict"
import test from "node:test"

import {
  isTransientDownloadError,
  withTransientRetries,
} from "./download-whisper.mjs"

function fetchFailed(code) {
  const error = new TypeError("fetch failed")
  error.cause = Object.assign(new Error(`read ${code}`), { code })
  return error
}

test("ECONNRESET from undici is transient", () => {
  assert.equal(isTransientDownloadError(fetchFailed("ECONNRESET")), true)
})

test("HTTP status errors are not transient", () => {
  assert.equal(
    isTransientDownloadError(new Error("HTTP 404 while downloading")),
    false,
  )
})

test("retries ECONNRESET then succeeds", async () => {
  let n = 0
  const result = await withTransientRetries(
    async () => {
      n += 1
      if (n < 3) throw fetchFailed("ECONNRESET")
      return "ok"
    },
    { delayMs: 0 },
  )
  assert.equal(result, "ok")
  assert.equal(n, 3)
})

test("does not retry HTTP errors", async () => {
  let n = 0
  await assert.rejects(() =>
    withTransientRetries(
      async () => {
        n += 1
        throw new Error("HTTP 404 while downloading")
      },
      { delayMs: 0 },
    ),
  )
  assert.equal(n, 1)
})
