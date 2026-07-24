#!/usr/bin/env node
// Applies supabase/migrations/*.sql to a throwaway Postgres container and runs
// supabase/tests/*.test.sql against it. Requires Docker; not part of `npm test`.
//
//   npm run test:db
import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CONTAINER = "sabbathcue-sql-tests"
const IMAGE = "postgres:16-alpine"

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...options })
}

function removeContainer() {
  docker(["rm", "-f", CONTAINER], { stdio: "ignore" })
}

function psql(sql, label) {
  const result = docker(
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-f",
      "-",
    ],
    { input: sql }
  )
  if (result.status !== 0) {
    process.stderr.write(`\n--- ${label} failed ---\n`)
    process.stderr.write(result.stdout ?? "")
    process.stderr.write(result.stderr ?? "")
    return false
  }
  return true
}

function waitForPostgres() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const ready = docker(["exec", CONTAINER, "pg_isready", "-U", "postgres"])
    if (ready.status === 0) return true
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},700)"])
  }
  return false
}

if (docker(["--version"]).status !== 0) {
  console.error("Docker is required for SQL tests. Install Docker and retry.")
  process.exit(1)
}

removeContainer()

const started = docker([
  "run",
  "-d",
  "--name",
  CONTAINER,
  "-e",
  "POSTGRES_PASSWORD=postgres",
  "-e",
  "POSTGRES_DB=postgres",
  IMAGE,
])
if (started.status !== 0) {
  console.error(started.stderr || "Could not start the Postgres container.")
  process.exit(1)
}

let failed = false
try {
  if (!waitForPostgres()) {
    console.error("Postgres did not become ready in time.")
    process.exit(1)
  }

  const harnessDir = path.join(repoRoot, "supabase", "tests", "harness")
  for (const file of readdirSync(harnessDir).sort()) {
    if (!file.endsWith(".sql")) continue
    console.log(`harness  ${file}`)
    if (!psql(readFileSync(path.join(harnessDir, file), "utf8"), file)) {
      failed = true
      break
    }
  }

  const migrationsDir = path.join(repoRoot, "supabase", "migrations")
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()

  if (!failed) {
    for (const file of migrations) {
      console.log(`migrate  ${file}`)
      if (!psql(readFileSync(path.join(migrationsDir, file), "utf8"), file)) {
        failed = true
        break
      }
    }
  }

  // Migrations are hand-run in the Supabase SQL editor, so the newest one has
  // to survive a repeat apply after a partial or aborted run. Older migrations
  // are not re-applied: 002 redefines admin_list_accounts() with a signature
  // that 008/009 later change, so re-running it out of order fails by design.
  const latest = migrations.at(-1)
  if (!failed && latest) {
    console.log(`reapply  ${latest}`)
    if (!psql(readFileSync(path.join(migrationsDir, latest), "utf8"), latest)) {
      failed = true
    }
  }

  const testsDir = path.join(repoRoot, "supabase", "tests")
  if (!failed) {
    for (const file of readdirSync(testsDir).sort()) {
      if (!file.endsWith(".test.sql")) continue
      console.log(`\ntest     ${file}`)
      const result = docker(
        [
          "exec",
          "-i",
          CONTAINER,
          "psql",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-q",
          "-f",
          "-",
        ],
        { input: readFileSync(path.join(testsDir, file), "utf8") }
      )
      process.stdout.write(result.stdout ?? "")
      if (result.status !== 0) {
        process.stderr.write(result.stderr ?? "")
        failed = true
      }
    }
  }
} finally {
  removeContainer()
}

if (failed) {
  console.error("\nSQL tests failed.")
  process.exit(1)
}
console.log("\nSQL tests passed.")
