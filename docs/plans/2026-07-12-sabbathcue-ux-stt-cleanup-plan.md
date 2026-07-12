# SabbathCue UX + STT Cleanup — Coding Agent Plan

> Instance of `CODING_AGENT_PLAN_TEMPLATE_v1.4.md`. All template protocol sections (§0 Prime Directive, §3 Tool Calling, §3A Micro-Test, §3B Quality Rubric, §4 Failure Modes, §5 Anti-Hallucination, §6 Code Appendix, §7 Hard Stops) apply **unchanged** and are incorporated by reference — they are not repeated here. This document fills in the plan-specific content: metadata, §1 scope, and the §2 checkpoint execution structure.

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | SabbathCue UX + STT Cleanup (5 work items) |
| **Version** | v1.4 |
| **Agent ID / Session** | fill in at execution start |
| **Codebase / Repo** | rhema (SabbathCue) — local checkout, branch off `main` |
| **Language / Stack** | TypeScript + React 19 + Zustand + Tailwind (frontend); Rust + Tauri 2 (`src-tauri` + workspace crates) |
| **Plan Author** | BongaNdlovu (operator) / plan drafted by Claude 2026-07-12 |
| **Date Created** | 2026-07-12 |
| **Completion Target** | fill in |

---

## HOW THIS PLAN IS STRUCTURED

The task contains **five independent work items** (WI-1 … WI-5, in priority order). Per the template's own checkpoint discipline and the request for *small, reviewable commits*:

- The checkpoint cycle **CP-01 → CP-06 runs once per work item**, in priority order. A work item's CP-03 may not start until its own CP-02 is operator-approved.
- Each work item lands as its own commit(s) on a feature branch (e.g. `feat/ux-stt-cleanup` or one branch per WI — operator's choice at kickoff).
- A later work item may start only after the previous one has passed its CP-04 regression sweep (WI-3 and WI-4 are coupled — see WI-4 notes — and may be planned in one CP-02 pass if the operator agrees).
- §6 Code Appendix entries are namespaced per work item: `A.1.WI1.1`, `A.2.WI3.2`, etc.

Repo-wide verification commands (used in every CP-03/CP-04):

- Frontend type-check: `npx tsc --noEmit` (or the repo's `npm run typecheck` if defined in `package.json` — confirm in CP-01)
- Frontend tests: `npx vitest run` (targeted: `npx vitest run <path> -t "<name>"`)
- Lint: `npm run lint` (confirm script name in CP-01)
- Rust: `cargo test --workspace` and `cargo check` run from `src-tauri/` (confirm feature flags; the STT crate gates Gladia behind a `gladia` cargo feature)

Baseline (capture before any change, log in §6 A.3.0): full `vitest` run, `tsc --noEmit`, `cargo test --workspace` outputs — this is the pre-existing-failure baseline referenced by every CP-04.

---

## § 1 · FULL SCOPE DEFINITION

### 1.1 What this plan accomplishes

Five changes to the SabbathCue operator app, in priority order:

1. **WI-1 — Remove Gladia STT provider.** Gladia is deleted as a selectable speech-to-text provider end-to-end: frontend provider picker/API-key UI/types/defaults, Tauri secret commands, Rust STT routing and client, docs/tutorial/marketing copy. Persisted `sttProvider: "gladia"` settings are **silently remapped to `"vosk"`** via the existing `parseSttProvider` migration pattern (this is the documented migration choice — no one-time notice; matches how whisper/sherpa removals were handled).
2. **WI-2 — "Collected for this service" detections.** A new session-scoped list capturing detections the operator acted on (presented live or added to queue — not the raw detection stream), rendered in the Detections workspace so previously used detections can be re-previewed, re-presented, or removed without retyping a search. Cleared on app restart (in-memory store, not persisted) with an explicit "Clear" action; empty state explains how items arrive.
3. **WI-3 — Proportional theme cards.** Cards inside `theme-library.tsx` (static + kinetic in the designer library) and `KineticThemesPage.tsx` grids get uniform width/height per grid: fixed `aspect-video` thumbnails (already present) plus normalized card frame (equal padding, fixed-height meta row, truncation) so uneven names/metadata cannot stretch neighbors.
4. **WI-4 — One Themes page, two columns.** The `kinetic-themes` workspace becomes a single **Themes** page: static themes in the left column, kinetic in the right (stacked on narrow widths). Select/apply/edit/delete behaviors are preserved for both kinds. Nav label, tutorial copy, and guard tests that treat the workspace as kinetic-only are updated. The workspace **id `kinetic-themes` is kept** (avoids persisted-store migration); only user-facing labels change.
5. **WI-5 — Quick-search ghost text fix.** In `preview-quick-search.tsx` and `QuickVerseSearch.tsx`, the grey autocomplete overlay renders only when the suggestion **case-insensitively starts with** the exact current input and the input is non-empty; only the suffix after the typed text is drawn. No grey full-string behind mismatched input, nothing left after clearing, no fight with the placeholder (placeholder shows only when input is empty, when the ghost never renders).

What must NOT change: detection pipeline behavior (other than the new collection hook points), queue semantics, Deepgram/Soniox/Vosk provider behavior, broadcast/live output rendering, and any workspace other than those listed.

### 1.2 Files in scope — grouped by work item

Paths are repo-relative. "(+ test)" = the sibling test file listed is also in scope. The CP-01 grep for each WI must confirm this list is complete before CP-02; any additional file found goes through the scope-expansion protocol (§4).

**WI-1 — Gladia removal (frontend):**
```
src/stores/settings-store.ts            (SttProvider union, hasGladiaApiKey state, parseSttProvider, key hydration)
src/stores/settings-store.test.ts
src/hooks/use-gladia-key-settings.ts    (DELETE)
src/hooks/use-transcription.ts          (+ use-transcription.test.ts)
src/components/settings/sections/SpeechSection.tsx   (provider radio, gladiaKeyAdapter, key panel)
src/components/settings/sections/ApiKeysSection.tsx
src/components/panels/transcript-panel.tsx
src/components/tutorial/tutorial-steps.ts
src/content/help-legal.ts               (+ help-legal.test.ts)
src/lib/controller-ui-guard.test.ts
video/src/TutorialVideo.tsx
landing/index.html
```

**WI-1 — Gladia removal (Rust/Tauri):**
```
src-tauri/src/lib.rs                    (unregister has/set/clear_gladia_api_key)
src-tauri/src/commands/secrets.rs       (gladia key fns + their unit tests)
src-tauri/src/commands/stt/provider.rs  (route "gladia" to the removed-provider error path, like faster-whisper)
src-tauri/src/commands/stt/utils.rs
src-tauri/src/commands/transcript_router.rs
src-tauri/crates/stt/Cargo.toml         (drop gladia feature + its deps if unused elsewhere)
src-tauri/crates/stt/src/lib.rs
src-tauri/crates/stt/src/gladia.rs      (DELETE)
src-tauri/crates/detection/src/pipeline.rs        (test fixtures naming "gladia" as a source string)
src-tauri/crates/detection/src/direct/detector.rs (same — comments/fixtures only; behavior unchanged)
src-tauri/crates/detection/src/direct/fuzzy.rs    (same)
```

**WI-1 — docs/marketing:**
```
README.md
web/content/docs/getting-started/speech-to-text.mdx
web/content/docs/getting-started/prerequisites.mdx
web/content/docs/features/ndi-broadcast.mdx
web/content/docs/architecture/tech-stack.mdx
web/content/docs/architecture/rust-crates.mdx
web/content/docs/architecture/project-structure.mdx
```
Out of WI-1 scope even though grep hits them: `docs/reports/*`, `docs/plans/*`, `docs/codebase-report.md`, `docs/procurement/*` (historical documents; do not rewrite history), `web/public/docs/diagrams/*.svg` (regenerate only if trivially editable text; otherwise log as follow-up in CP-06 §8).

**WI-2 — Collected detections:**
```
src/stores/collected-detections-store.ts        (CREATE — session-scoped Zustand store + test)
src/stores/collected-detections-store.test.ts   (CREATE)
src/components/panels/detections-panel.tsx      (record on present/queue in getDetectionActions; render collected section)
src/components/panels/detections-panel.test.tsx
src/components/panels/latest-detection-bar.tsx  (its actions flow through the same recording point — verify in CP-01)
src/components/panels/latest-detection-bar.test.tsx
```

**WI-3 — Proportional cards:**
```
src/components/broadcast/theme-library.tsx      (+ theme-library.test.tsx)
src/components/broadcast/KineticThemesPage.tsx  (+ KineticThemesPage.test.tsx)
```

**WI-4 — Unified Themes page:**
```
src/components/broadcast/KineticThemesPage.tsx  (becomes/renders the two-column ThemesPage; rename decision in CP-02)
src/components/broadcast/KineticThemesPage.test.tsx
src/lib/dashboard-workspace-nav.ts              (label "Kinetic Themes" → "Themes")
src/lib/dashboard-workspace-nav.test.ts
src/components/layout/dashboard.tsx             (+ dashboard.test.tsx)
src/components/layout/workspace-top-nav.tsx     (+ workspace-top-nav.test.tsx)
src/components/tutorial/tutorial-steps.ts       (data-tour="kinetic-themes" copy)
src/lib/builtin-themes.ts                       (only if static/kinetic partition helpers are needed)
src/components/service-plan/LiveServicePlanPage.tsx (+ test — only where it links to the kinetic-themes workspace)
```

**WI-5 — Ghost text:**
```
src/components/panels/preview-quick-search.tsx
src/components/panels/search/QuickVerseSearch.tsx
src/hooks/use-quick-verse-search.ts             (suggestion production — read; modify only if fix belongs at source)
src/lib/quick-search.ts (+ quick-search.test.ts) (getAutocompleteSuggestion — same condition)
```
A shared ghost-suffix helper (single function, e.g. in `src/lib/quick-search.ts`) is preferred over duplicating the prefix-match logic in both components (§0 DRY).

### 1.3 Files explicitly OUT of scope

```
Any file not listed in §1.2 (per-WI)
src/stores/detection-store.ts and the Rust detection pipeline behavior (WI-2 reads from action handlers, not the stream)
src-tauri/crates/detection/*  (except the named comment/fixture touch-ups in WI-1)
package.json / Cargo.toml dependency additions (removals in stt/Cargo.toml for WI-1 are allowed)
.env files, migrations, docs/reports/*, docs/procurement/*, docs/plans/* (other than this file)
docs/superpowers/** (gitignored, local-only)
Queue store/panel internals, broadcast live-output renderers, projector/external-monitor code
```

### 1.4 Dependencies and external systems involved

```
Tauri 2 IPC (invoke) — settings hydration calls has_gladia_api_key today; WI-1 removes the call and command together
OS keychain via the keyring crate (secrets.rs) — WI-1 deletes gladia entries' accessors; existing stored keys become orphaned (acceptable; log in CP-06 §6)
rhema_stt crate cargo features (deepgram/gladia/soniox) — WI-1 removes the gladia feature; confirm default feature set still builds
Zustand persisted stores — WI-1 relies on parseSttProvider migration on hydrate; WI-4 deliberately avoids workspace-id migration
Vitest + happy-dom/RTL for UI tests; cargo test for Rust
No new external dependencies are permitted by this plan (HS-9)
```

### 1.5 Definition of done

```
WI-1: "gladia" (case-insensitive) greps to zero hits in src/, src-tauri/, video/, landing/, README.md, web/content/docs/
      (excluding the §1.2 historical-docs exclusions and this plan file). Provider picker shows Vosk/Deepgram/Soniox only.
      A persisted sttProvider:"gladia" hydrates as "vosk" (unit test proves it). If the backend ever receives
      provider="gladia" it returns the same removed-provider error used for faster-whisper. tsc 0 errors,
      vitest suite ≥ baseline, cargo test --workspace passes with the gladia feature gone.

WI-2: During a session, presenting or queueing a detection adds one deduplicated entry to a "Collected for this
      service" section in the Detections workspace. Each entry offers Preview, Go Live, Queue, and Remove; a Clear
      action empties the list; empty state copy explains how items get in. List does not survive app restart.
      Store unit tests + a panel render test pass.

WI-3: Within each themes grid, all cards render equal width and equal height regardless of name/metadata length
      (long names truncate; meta rows have fixed height). No card stretches its row neighbors. Existing
      theme-library and KineticThemesPage tests still pass.

WI-4: One "Themes" workspace shows Static (left) and Kinetic (right) columns side-by-side at desktop width and
      stacked below (single breakpoint, e.g. lg). Apply/edit/delete work for both kinds from this page. Nav shows
      "Themes"; guard tests (dashboard-workspace-nav.test.ts, workspace-top-nav.test.tsx, dashboard.test.tsx)
      updated and green. No separate static-vs-kinetic navigation remains.

WI-5: Reproduced failure case is captured first (CP-01). After the fix: ghost suffix renders only when the
      suggestion case-insensitively starts with the current input; empty/cleared/mismatched input shows no grey
      overlay; a focused component/unit test covers match, mismatch, and cleared states in both surfaces.

Global: no files outside §1.2 modified; zero new tsc/eslint/cargo errors; every commit's diff matches its
        approved CP-02 blocks.
```

---

## § 2 · CHECKPOINT EXECUTION PLAN

> CP-01 … CP-06 as defined in the template, executed **once per work item, in order WI-1 → WI-5**. Statuses below are per-WI; copy this table into the session log at kickoff.

| Checkpoint | WI-1 | WI-2 | WI-3 | WI-4 | WI-5 |
|---|---|---|---|---|---|
| CP-01 Read & grep | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-02 Generate code + operator sign-off | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-03 Apply + targeted tests | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-04 Full regression sweep | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-04.5 Quality review (6 dimensions) | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-05 Final diff review | PENDING | PENDING | PENDING | PENDING | PENDING |
| CP-06 Change report (§6 A.7) | PENDING | PENDING | PENDING | PENDING | PENDING |

### Per-WI CP-01 grep commands (minimum set)

```
WI-1: grep -rni "gladia" src src-tauri video landing README.md web/content/docs
WI-2: grep -rn "getDetectionActions\|presentVerse\|createScriptureQueueItem\|addOrFlashItem" src
WI-3: grep -rn "aspect-video\|ThemeCard\|KineticThemeCard" src/components/broadcast
WI-4: grep -rn "kinetic-themes\|Kinetic Themes" src
WI-5: grep -rn "suggestion\|showGhost\|getAutocompleteSuggestion" src/components/panels src/hooks/use-quick-verse-search.ts src/lib/quick-search.ts
```

### Plan-author implementation notes (constraints for CP-02 — not pre-approved code)

These record design decisions already made, so CP-02 does not re-litigate them. CP-02 still writes and gets sign-off on the exact BEFORE/AFTER code.

**WI-1**
- Follow the faster-whisper removal precedent visible in `src-tauri/src/commands/stt/provider.rs` (~line 222): `"gladia"` becomes a removed-provider match arm returning `The Gladia speech-to-text provider has been removed. Choose Vosk, Deepgram, or Soniox.` Update the two "Choose Vosk, Deepgram, Gladia, or Soniox." strings.
- Frontend migration: remove `"gladia"` from the `SttProvider` union and from `parseSttProvider` (settings-store.ts:107–119); the existing fallthrough `return "vosk"` performs the silent remap. Add a unit test: `parseSttProvider("gladia") === "vosk"`.
- Remove `hasGladiaApiKey` state + setter + hydration invoke (settings-store.ts:20/38/56/72/195–201), `use-gladia-key-settings.ts`, `gladiaKeyAdapter`, and the `sttProvider === "gladia"` key panel in `SpeechSection.tsx`.
- Rust: delete `gladia.rs`, the `gladia` feature and `GladiaClient` re-export in `crates/stt/src/lib.rs`, the secrets fns/tests in `secrets.rs` (66–104, 153–197, 420–429 + tests), the three command registrations in `lib.rs` (148–150). Check whether tungstenite/websocket deps in `crates/stt/Cargo.toml` are used only by Gladia before removing them.
- Detection-crate hits are test fixture strings using "gladia" as an arbitrary source label — rename the label (e.g. to "deepgram"), do not change behavior.
- Commit granularity: (a) frontend, (b) Rust, (c) docs/copy — or a single commit if the operator prefers; decide at CP-02 sign-off.

**WI-2**
- New in-memory (non-persisted) Zustand store `useCollectedDetectionsStore`: `items: CollectedDetection[]` (verse-ref key, display text, kind scripture/egw/hymn, firstUsedAt, lastUsedAt, useCount), `record(item)` (dedupe by normalized ref, bump lastUsedAt/useCount, most-recent-first), `remove(key)`, `clear()`. Cap the list (e.g. 50) to bound the session.
- Single hook point: `getDetectionActions` in `detections-panel.tsx` (~lines 130–190) — wrap the `present` and `queue` closures to also `record(...)`. CP-01 must verify `latest-detection-bar.tsx` consumes these same actions; if it duplicates them, record there too (or lift the helper).
- UI: a collapsible "Collected for this service" section at the top of `DetectionsPanel`, each row reusing the existing Preview / Go Live / Queue button pattern plus a Remove ✕ and a header-level "Clear" button. Empty state: "Verses you present or queue during this service appear here for quick reuse."
- Preview alone does **not** collect (spec: accepted/presented/queued).

**WI-3**
- `theme-library.tsx` `ThemeCard`: grid cells already share width; enforce equal height via fixed-height info row (`truncate` on name — present — plus a fixed line-height/height on the meta area) and `h-full flex flex-col` card frame so grid rows align.
- `KineticThemesPage` `KineticThemeCard`: same treatment; keep `aspect-video` thumbnails as the size anchor.
- No visual redesign — spacing/typography stay as-is; only dimension normalization.

**WI-4**
- Keep workspace id `kinetic-themes` (no persisted-store migration); change only the nav label to "Themes" in `dashboard-workspace-nav.ts:69` and dependent tests/tutorial copy. If CP-02 finds the id is trivially renameable (workspace store not persisted), the operator may approve a rename — but the default is keep.
- Rework `KineticThemesPage` into a `ThemesPage` layout: `grid gap-4 lg:grid-cols-2`; left column lists `themes.filter(t => !t.kinetic)`, right `themes.filter(t => Boolean(t.kinetic))`, both using the WI-3-normalized card. Apply/edit/delete wire to the same `useBroadcastThemeStore` / `useBroadcastDesignerStore` calls already used at KineticThemesPage.tsx:142–155.
- RISK to resolve in CP-01: `theme-library.tsx` reads `useBroadcastThemeDesignerStore` while `KineticThemesPage` reads `useBroadcastThemeStore` — determine whether these are one store aliased or two, and which is the source of truth for static themes, **before** writing CP-02 code.
- WI-3 and WI-4 both edit `KineticThemesPage.tsx`; execute WI-3 first (card component), then WI-4 consumes the normalized card. If the operator prefers, combine them into one CP-02 review.

**WI-5**
- Reproduce first (template §4 discipline + systematic-debugging): typed input where `getAutocompleteSuggestion` returns a suggestion that does not literally start with the raw input (e.g. numbered-book normalization "1jo" → "1 John 1:1", or case differences), showing the misaligned/full grey string.
- Root-cause fix: compute the ghost suffix in one shared helper — render only if `input.length > 0 && suggestion.toLowerCase().startsWith(input.toLowerCase()) && suggestion.length > input.length`, suffix = `suggestion.slice(input.length)`; otherwise render nothing. Apply in `preview-quick-search.tsx:314–323` and `QuickVerseSearch.tsx:25–43`.
- Tests: unit-test the helper (match / case-differing match / mismatch / empty input / suggestion === input) and keep or add one render assertion per component that no ghost node exists on mismatch.

### Phase C skeleton (fill per WI at CP-02)

```
RISKS & UNKNOWNS (seed list — extend at CP-02):
  WI-1: gladia cargo feature may be in default features → build breaks if removed carelessly; detect via cargo check.
        Orphaned gladia_api_key entries remain in OS keychains (accepted; no cleanup command shipped).
  WI-2: latest-detection-bar may hold its own action closures → collection missed from Live Desk; detect in CP-01 read.
  WI-4: two theme stores (designer vs broadcast) may hold different theme lists → static column could show wrong data;
        resolve store topology in CP-01 before generating code.
  WI-5: hiding the ghost on normalization mismatches removes a hint some operators used; acceptable per spec
        ("never a full grey string"), note in CP-06 §6.

TESTS THAT MAY BREAK:
  settings-store.test.ts, use-transcription.test.ts, help-legal.test.ts, controller-ui-guard.test.ts (WI-1 — update)
  secrets.rs unit tests, stt provider routing tests (WI-1 — delete/update)
  KineticThemesPage.test.tsx, theme-library.test.tsx (WI-3/WI-4 — update)
  dashboard-workspace-nav.test.ts, workspace-top-nav.test.tsx, dashboard.test.tsx, LiveServicePlanPage.test.tsx (WI-4 — update labels)
  quick-search.test.ts (WI-5 — extend)

PRE-EXISTING FAILURES: capture in baseline run (§6 A.3.0) before WI-1 CP-03.
```

---

## §§ 3–7 · PROTOCOLS

Apply exactly as written in `CODING_AGENT_PLAN_TEMPLATE_v1.4.md` (§0, §3, §3A, §3B, §4, §5, §7). Note for this repo:

- E2E/UI tests must set `onboardingComplete` in settings or the joyride tour overlay blocks all clicks (known gotcha).
- After WI-1, verify against a **fresh build** — stale `SabbathCue.exe` builds have previously masked fixes; check binary timestamp vs commit.
- `docs/superpowers/**` is gitignored — never stage anything from there.

---

## § 6 · CODE APPENDIX

Append-only, populated during execution. Namespace entries per work item: `A.1.WI<n>.<change>`, `A.2.WI<n>.<change>`, `A.3.<run>`, `A.4.WI<n>.<file>`, `A.5.*`, `A.6.*`, `A.7` (one Change Report per WI, or one consolidated report — operator decides at WI-1 CP-06).

```
A.3.0 — BASELINE (before any change)
[ paste full vitest, tsc --noEmit, and cargo test --workspace outputs here at kickoff ]
```

---

## PLAN COMPLETION SIGN-OFF

| Work item | CP-01 | CP-02 | CP-03 | CP-04 | CP-04.5 | CP-05 | CP-06 | Quality | Anti-bloat |
|---|---|---|---|---|---|---|---|---|---|
| WI-1 Gladia removal | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| WI-2 Collected detections | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| WI-3 Proportional cards | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| WI-4 Unified Themes page | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| WI-5 Ghost text fix | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

**Human operator final sign-off:** `[ NAME ]` · `[ DATE ]`
**Definition of done verified (§1.5, all WIs):** `[ YES / NO ]`
