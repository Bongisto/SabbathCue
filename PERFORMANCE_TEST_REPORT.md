# Performance Testing Report

> **Living document.** This file reflects the *current* performance state of the codebase. Update it whenever a change could affect speed, load, resource use, or scalability. Keep measured numbers with their date and conditions so regressions are visible over time.

| Field | Value |
|---|---|
| **Last updated** | `2026-06-18 16:40` |
| **Updated by** | `Claude (Opus 4.8) — automated assessment` |
| **Commit / build** | `d43f1de` (branch `main`, clean tree) |
| **Test environment** | `local` — Windows 11, Node/Vite build, no app runtime profiling |
| **Overall status** | 🟡 Mixed |
| **Open regressions** | `0` |

> **Scope note.** `sabbathcue`/`rhema` is a **Tauri 2 desktop app** (React 19 webview + Rust backend), not a hosted web service. Server-style metrics (TTFB, API p50/p95/p99, throughput, DB load) are **not applicable** to the desktop runtime and are marked accordingly. The two genuinely measurable build-time signals — **bundle composition** and **build/test pipeline timing** — were measured directly. **Runtime** signals (FPS during live broadcast, canvas render latency, memory growth over a service, STT/detection latency) require launching the app with instrumentation and are **not yet measured**; they are the most valuable next step for this app and are flagged below.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ Meets target | Within budget |
| ⚠️ Near limit | Within ~10% of budget / trending wrong way |
| ❌ Over budget | Exceeds target |
| 🔻 Regression | Worse than previous recorded run |
| 🔺 Improvement | Better than previous recorded run |
| 🧪 Not measured | Not yet benchmarked |
| ➖ N/A | Not applicable to a Tauri desktop app |

---

## 1. Summary Dashboard

| Metric | Target / Budget | Latest | Status | Trend | Measured |
|---|---|---|---|---|---|
| Time to First Byte (TTFB) | ➖ | local webview, no network | ➖ N/A | — | 2026-06-18 |
| First Contentful Paint (FCP) | < 1.0 s (local webview) | not profiled | 🧪 | — | — |
| Largest Contentful Paint (LCP) | < 1.5 s | not profiled | 🧪 | — | — |
| Time to Interactive (TTI) | < 2.0 s | not profiled | 🧪 | — | — |
| Cumulative Layout Shift (CLS) | < 0.1 | not profiled | 🧪 | — | — |
| API p50 latency | ➖ | Tauri IPC `invoke`, in-process | ➖ N/A | — | — |
| API p95 latency | ➖ | — | ➖ N/A | — | — |
| API p99 latency | ➖ | — | ➖ N/A | — | — |
| Throughput (req/s) | ➖ | single-user desktop | ➖ N/A | — | — |
| Error rate under load | ➖ | — | ➖ N/A | — | — |
| Peak memory | < 600 MB idle (target) | not profiled | 🧪 | — | — |
| Peak CPU | < 25% idle, no runaway | not profiled | 🧪 | — | — |
| **Initial JS (gzipped)** | **< 350 KB** | **~313 KB** (main 69 + vendor 134 + react 54 + supabase 50 + tauri 6) | ✅ | 🔺 | 2026-06-18 |
| **Largest single chunk (raw)** | < 500 KB (rolldown warn) | **460 KB** (`vendor`, was 877) | ✅ | 🔺 | 2026-06-18 |
| **Total JS bundle (raw)** | < 3 MB | **3.9 MB** across 51 chunks | ❌ | — | 2026-06-18 |
| **Production build time** | < 20 s | **9.2 s** (16 s wall) | ✅ | — | 2026-06-18 |
| **Unit test suite runtime** | < 30 s | **~13 s** (603 tests) | ✅ | — | 2026-06-18 |
| Cold start / boot time | < 2.5 s | not profiled | 🧪 | — | — |

---

## 2. Detailed Results

### 2.1 Frontend / Page Load

- **Status:** 🧪 Not measured (runtime)
- **Conditions:** Tauri WebView2 (Windows). The app loads from bundled assets on disk, so there is no network TTFB; load cost is dominated by JS parse/exec of the initial chunks (`main` + `vendor` + `ui` + `icons`).
- **Measured:** Not yet. Core Web Vitals / hydration time require launching the packaged app with the DevTools Performance panel or a `performance.mark` harness in `main.tsx`.
- **Notes / findings:**
  - Initial critical path pulls `main` (260 KB / 71 KB gz) + `vendor` (877 KB / 253 KB gz) + `ui` (83 KB / 23 KB gz) + `icons` (25 KB / 8 KB gz). Estimated initial gzipped payload ≈ **324–355 KB**, near the 350 KB budget. This is the single highest-leverage page-load lever (see §2.2).
  - Two HTML entry points exist (`index.html` main app, `broadcast-output.html` output window). The broadcast output window is correctly isolated to a small `broadcast` chunk (9 KB / 3.6 KB gz), which is good for the live-output path.

### 2.2 Asset & Bundle Analysis

- **Status:** ✅ Meets target (was ⚠️ Near limit) — 🔺 improved 2026-06-18 by R1
- **Checked:** bundle size per route/chunk, code splitting, manual chunking, lazy loading. Tool: `vite build` (rolldown) reporter, 2026-06-18.
- **Notes / findings:**
  - ✅ **Good code-splitting hygiene.** The 7 SDA hymnal data chunks (~90–137 KB each raw) are split out and lazy-loaded, not in the initial bundle. `theme-designer` (53 KB), `SettingsPage` (49 KB), `tour` (78 KB / 26 KB gz), and the `pdf.worker` (1.14 MB) are all separate, lazily-fetched chunks. Manual `manualChunks` config in [vite.config.ts](vite.config.ts) deliberately isolates `canvas` (fabric), `search` (fuse.js), `tour`, `icons`, `dialog`, and `ui`.
  - 🔺 **PERF-001 addressed (R1, 2026-06-18):** the monolithic `vendor` chunk was split. **Before:** `vendor` 877 KB raw / 253 KB gz (tripped rolldown's 500 KB warning). **After:** `vendor` 460 KB / 134 KB gz + `react` 174 KB / 54 KB gz + `supabase` 196 KB / 50 KB gz + `tauri` 25 KB / 5.6 KB gz + `state` 0.7 KB. Total initial payload is roughly unchanged (same dependencies, ~313 KB gz) — the win is **caching granularity** (React/Supabase/Tauri are stable across app releases, so app-code updates no longer invalidate them) and clearing the >500 KB chunk warning. See [CODE_REFACTORING_PLAN.md](CODE_REFACTORING_PLAN.md) R1.
  - ⚠️ **`canvas` (fabric.js) is 280 KB / 87 KB gz.** Fabric is only needed by the theme designer / design canvas, not at first paint — confirm it is lazy and not in the initial graph (PERF-002).
  - ⚠️ **`pdf.worker.min` is 1.14 MB raw** (PowerPoint/PDF import). It is a worker (lazy), so it does not hit first paint, but it is the largest single asset — confirm it loads only on import.
  - ⚠️ **`verse-renderer.css` is 167 KB / 26 KB gz.** Large for a single stylesheet; likely Tailwind output. Verify Tailwind content globbing is pruning unused utilities.
  - Total: **3.9 MB raw JS across 47 chunks**; rolldown warns several chunks exceed the 500 KB raw threshold (`vendor`, `canvas`, `pdf.worker`).

### 2.3 API / Backend Latency

- **Status:** ➖ N/A (desktop) / 🧪 partially measurable
- **Conditions:** There is no HTTP API in the desktop path. The frontend talks to Rust via Tauri `invoke` IPC (in-process). The Rust side (`src-tauri`, 8,362 LOC across 28 files) hosts STT/detection, asset, broadcast, and secrets commands.
- **Measured:** Per-command IPC latency not yet instrumented. The hot paths worth timing are STT detection ([src-tauri/src/commands/stt/detection.rs](src-tauri/src/commands/stt/detection.rs), 1,156 LOC) and verse detection ([src-tauri/src/commands/detection.rs](src-tauri/src/commands/detection.rs), 1,015 LOC), which run continuously during a live service.

| Endpoint / IPC command | p50 | p95 | p99 | Status |
|---|---|---|---|---|
| `stt::detection` (live transcript → verse match) | — | — | — | 🧪 |
| `detection` (embedding similarity search) | — | — | — | 🧪 |
| broadcast render/emit | — | — | — | 🧪 |

> **Note:** A separate hosted `web/` (Next.js) sub-project and Supabase backend exist. If those are in scope, they should get their own server-style latency/load section; this report covers the desktop app.

### 2.4 Database / Data Layer

- **Status:** 🧪 Not measured
- **Checked:** The app ships a bundled Bible SQLite DB (built via `build:bible`) and a precomputed embeddings binary (`embeddings/kjv-nkjv-nlt-minilm-l6-v2.bin`). Embeddings are precomputed offline (Rust/ONNX), which is the right call — no per-query embedding cost at runtime.
- **Notes / findings:**
  - Verse semantic search loads a precomputed embedding matrix and does in-memory similarity — measure load time and per-query cost under a realistic verse corpus.
  - SQLite query plans for verse/reference lookup are not yet reviewed for index coverage.

### 2.5 Load & Stress Testing

- **Status:** ➖ N/A for the desktop app (single operator). The relevant "load" analogue is a **sustained live service**: continuous STT transcription + detection + canvas rendering for 60–120 minutes.
- **Scenario (recommended):** Run a 90-minute simulated service with continuous audio and observe memory growth, detection latency drift, and dropped-frame behavior on the broadcast output window.
- **Notes / findings:** *none recorded yet — this is the highest-value missing test for this app.*

### 2.6 Resource Utilization

- **Status:** 🧪 Not measured
- **Measured:** CPU/memory/GC during a live service not yet profiled. With 128 `useEffect`, 92 `useCallback`, and 42 `useMemo` across the React tree, and a live canvas render loop, re-render churn and listener cleanup are the likely hotspots.
- **Notes / findings:**
  - Watch for memory growth across slide transitions (canvas/fabric object disposal) and Tauri event-listener leaks (verify `use-tauri-event` unsubscribes — it has dedicated tests, which is a good sign).

### 2.7 Caching & Scalability

- **Status:** ➖ Mostly N/A (offline-first desktop)
- **Checked:** No CDN/app-server cache layer in the desktop path. App data (themes, settings, queue) is persisted via `@tauri-apps/plugin-store`. A `context-search-cache` chunk exists, indicating search-result caching.
- **Notes / findings:** Statelessness/horizontal scaling do not apply. Verify the persisted store writes are debounced (frequent settings writes during a service could cause disk I/O churn).

---

## 3. Identified Bottlenecks

| ID | Area | Description | Impact | Suggested fix | Status | Owner |
|---|---|---|---|---|---|---|
| PERF-001 | Bundle | `vendor` chunk 877 KB / 253 KB gz dominated initial payload | High | Split `vendor` in `manualChunks` (react / supabase / tauri / state separated) | **Fixed (R1, 2026-06-18)** — vendor now 460 KB / 134 KB gz | |
| PERF-002 | Bundle | `canvas`/fabric 280 KB (87 KB gz) — confirm not in first-paint graph | Med | Ensure design-canvas/theme-designer are `React.lazy`-loaded; verify fabric isn't imported by an eagerly-loaded module | Open | |
| PERF-003 | Runtime | No live-service runtime profiling (FPS, memory growth, detection latency) | High | Add `performance.mark` harness + run a 90-min service profile; record memory at start/30/60/90 min | Open | |
| PERF-004 | CSS | `verse-renderer.css` 167 KB / 26 KB gz | Low | Confirm Tailwind content globbing prunes unused utilities for the build | Open | |
| PERF-005 | Assets | `pdf.worker.min` 1.14 MB raw | Low | Confirm worker loads only on PPT/PDF import, never at boot | Open | |

---

## 4. Benchmark History

> Append newest at the top. Lets you spot regressions across builds.

| Date | Commit | Key metric | Value | vs previous |
|---|---|---|---|---|
| `2026-06-18` | `8424fdb`+R1 | Largest single chunk (raw) | 460 KB (`vendor`) | 🔺 from 877 KB |
| `2026-06-18` | `8424fdb`+R1 | `vendor` gzipped | 134 KB | 🔺 from 253 KB |
| `2026-06-18` | `d43f1de` | Production build time | 9.2 s | ➖ (baseline) |
| `2026-06-18` | `d43f1de` | Unit test suite (603 tests) | ~13 s | ➖ (baseline) |
| `2026-06-18` | `d43f1de` | Total JS bundle (raw) | 3.9 MB / 47 chunks | ➖ (baseline) |
| `2026-06-18` | `d43f1de` | Initial JS (gz, main+vendor) | ~324 KB | ➖ (baseline) |

---

## 5. Tools & Methods Used

| Tool / method | Version | Scope | Last run |
|---|---|---|---|
| Vite build (rolldown) reporter | per `package.json` | Bundle size / chunking | 2026-06-18 |
| Vitest | v4.1.6 | Unit test runtime | 2026-06-18 |
| `tsc --noEmit` | per `tsconfig` | Typecheck (passed) | 2026-06-18 |
| ESLint flat config | per `eslint.config.js` | Lint (passed, 0 warnings) | 2026-06-18 |
| Lighthouse / runtime profiler | — | Web Vitals, memory | 🧪 not yet run |
| Live-service soak profile | — | Memory growth, detection latency | 🧪 not yet run |

---

## 6. Change Log

| Date | By | Summary of change | Metrics affected |
|---|---|---|---|
| `2026-06-18` | Claude (Opus 4.8) | **R1: split monolithic `vendor` chunk** (877→460 KB raw / 253→134 KB gz) into react/supabase/tauri/state. Overall status → 🟡 Mixed still (total raw bundle + runtime unprofiled). | Bundle composition, caching |
| `2026-06-18` | Claude (Opus 4.8) | Initial measured baseline: build, bundle, tests, lint, typecheck. Runtime/web-vitals flagged as not-yet-measured. | Bundle, build time, test runtime |

---

## How to maintain this report

1. Re-run the relevant benchmarks under the **same conditions** as the prior run (note them).
2. Update the dashboard value, **Status**, and **Trend** (compare to last recorded run).
3. Add a row to **Benchmark History** for the metric(s) you measured.
4. Log new slow paths in **Identified Bottlenecks**; mark fixed ones without deleting.
5. Recompute the header (**Overall status**, **Open regressions**) and add a **Change Log** entry.
