# Code Logic Review Findings - SabbathCue

> Adversarial code-logic review using `CODE_LOGIC_REVIEW_PROMPT.md`.
> Goal: find how the code could fail, mislead, or break under real operator conditions.

**Reviewed:** June 9, 2026  
**Repository:** `c:\Users\fanel\Downloads\rhema-main\rhema-main`  
**Scope:** live production paths: detection ingestion/ranking, verse detection workflow, queue/broadcast sync, projector output, NDI output, monitor targeting, and related tests.  
**Working tree note:** `code-logic-review-findings.md` is untracked; no tracked code changes were reviewed as a diff.

## Executive Summary

The detection ranking and merge code has meaningful test coverage and handles several important edge cases. The highest production risk is not the core ranking logic. It is live-output failure safety: projector/NDI sync failures are caught but only logged to the console, so an operator can believe output is correct while the real display is stale, frozen, or targeted at the wrong monitor.

The review is **INCOMPLETE for proving correctness** because some requirements are not precise enough to test: incoming detection batch ordering, broadcast `enabled` semantics, and stable monitor identity. The code can still be reviewed for risks, and those risks are concrete.

## Findings

### F-01 - Broadcast sync failures are invisible to the operator

**Severity:** High  
**Files:** `src/stores/broadcast-store.ts:154`, `src/stores/broadcast-store.ts:163`, `src/stores/broadcast-store.ts:290`, `src/hooks/use-broadcast-output-settings.ts:258`

`emitTo(..., "broadcast:verse-update", ...)` and `emitTo(..., "broadcast:ndi-config", ...)` failures are handled with `console.warn` only. If the projector window or hidden NDI webview misses a sync event, the operator gets no visible status change.

**Failure mode:** live output can show a stale verse, stale theme, or stale opacity while the UI continues to look normal.

**Required action:** add operator-visible broadcast output health state, toast/status-strip warning, and tests that simulate `emitTo` rejection.

### F-02 - NDI frame push failures are invisible while NDI can still appear active

**Severity:** High  
**Files:** `src/hooks/use-broadcast-output-runtime.ts:165`, `src/hooks/use-broadcast-output-runtime.ts:168`, `src/lib/broadcast-output-ndi.ts:92`

`push_ndi_frame` failures are caught by `warnNdiPushFailure`, which logs only. The UI can keep showing NDI as active even if frame transmission fails repeatedly.

**Failure mode:** OBS or another NDI receiver may see a frozen frame while the app gives no production-visible warning.

**Required action:** count consecutive push failures, surface a warning to the main window, and reconcile/stop NDI state after a threshold.

### F-03 - Broadcast output `enabled` is not a reliable lifecycle state

**Severity:** High  
**Files:** `src/hooks/use-broadcast-output-settings.ts:243`, `src/hooks/use-broadcast-output-settings.ts:364`

`enabled` is local React state initialized to `false`. It is not derived from preview window state, NDI backend state, or persisted output state. `handleToggleEnabled` sets it before `runDisableBroadcastOutput` completes.

**Failure mode:** the dialog can say "Off" while preview or NDI is still active, especially after reopening the dialog or when teardown fails.

**Required action:** derive enabled from `isPreviewOpen || ndiActive`, reconcile on dialog open, and only show disabled/off after teardown succeeds.

### F-04 - Monitor selection uses unstable array indexes

**Severity:** High  
**Files:** `src/components/broadcast/BroadcastOutputCard.tsx:196`, `src/components/broadcast/broadcast-settings-wiring.ts:9`, `src-tauri/src/commands/broadcast.rs:121`

The frontend stores monitor selection as `String(i)`. The backend then uses `available_monitors().get(monitor_index)`. This assumes monitor order is stable across refresh, hotplug, sleep/wake, and OS display changes.

**Failure mode:** output can open on the wrong display/projector after monitor order changes.

**Required action:** expose a stable monitor identifier where Tauri/OS supports it, or store a monitor fingerprint such as name + size + position and re-resolve it before opening.

### F-05 - Detection preview assumes incoming batch order equals recency

**Severity:** Medium  
**File:** `src/lib/verse-detection-workflow.ts:115`

`handleVerseDetections` filters direct hits and previews `directHits[0]`. The test in `src/lib/verse-detection-workflow.test.ts` asserts "first direct detection from incoming event batch" but does not prove that the event emitter guarantees newest-first order.

**Failure mode:** in multi-hit batches, the wrong verse may be selected for preview.

**Required action:** document the IPC/event ordering contract, or choose the preview target by explicit timestamp/rank/confidence instead of array position.

### F-06 - Duplicate detection settings create a single-source-of-truth violation

**Severity:** Medium  
**Files:** `src/stores/detection-store.ts:20`, `src/stores/detection-store.ts:156`, `src/stores/settings-store.ts:11`, `src/hooks/use-detection.ts:69`, `src/hooks/use-detection-settings-sync.ts:10`

`settings-store` is the authoritative source for `autoMode` and `confidenceThreshold`, and it syncs to the backend. `detection-store` also stores and exposes fields with the same names.

**Failure mode:** future code can read `useDetection().autoMode` and silently use stale values.

**Required action:** remove these fields from `detection-store`, or explicitly bridge them from `settings-store`.

### F-07 - Manual `detect_verses` failure looks like "no result"

**Severity:** Medium  
**File:** `src/hooks/use-detection.ts:19`

`detectVerses` catches errors, logs a warning, and returns `[]`. A failed detection command is indistinguishable from successful detection with no verses.

**Failure mode:** operator/user may trust an empty detection result after a backend failure.

**Required action:** return an error state or show a toast/status message for manual detection failures.

### F-08 - Detection settings backend sync failure is silent

**Severity:** Medium  
**File:** `src/hooks/use-detection-settings-sync.ts:17`

`update_detection_settings` failures are `console.warn` only.

**Failure mode:** UI settings can diverge from backend auto-live behavior.

**Required action:** surface sync failure and retry or show "settings not applied" state.

### F-09 - No in-flight guard for preview and NDI toggles

**Severity:** Medium  
**Files:** `src/hooks/use-broadcast-output-settings.ts:355`, `src/hooks/use-broadcast-output-settings.ts:359`

`handleTogglePreview` and `handleToggleNdi` do not block duplicate clicks while commands are pending.

**Failure mode:** rapid clicks can issue duplicate `open_broadcast_window`, `ensure_broadcast_window`, `start_ndi`, or `stop_ndi` calls and leave local state inconsistent.

**Required action:** add per-output command-pending flags and tests for double-click behavior.

### F-10 - NDI active state is not reconciled in the settings dialog

**Severity:** Medium  
**Files:** `src/hooks/use-broadcast-output-settings.ts:251`, `src-tauri/src/commands/broadcast.rs:203`

The runtime window checks `get_ndi_status` on mount, but the settings dialog initializes `ndiActive` to `false` and does not query backend status when opened.

**Failure mode:** settings can show NDI stopped even if a hidden NDI window/session is active, or active when backend state changed elsewhere.

**Required action:** call `get_ndi_status` when the settings dialog opens and update `ndiActive`, resolution, and frame rate.

### F-11 - Verse fetch failure during queueing is intentionally silent

**Severity:** Low-Medium  
**File:** `src/lib/verse-detection-workflow.ts:70`

`resolveDetectionVerse` falls back to current chapter or detection text if `fetchVerse` fails. The fallback is useful, but the failure is invisible.

**Failure mode:** queued/broadcast text may come from stale detection data or the wrong translation without the operator knowing lookup failed.

**Required action:** keep fallback behavior, but mark the queue item or show a lightweight warning when lookup failed.

### F-12 - Overlapping detection event handling is not serialized

**Severity:** Low-Medium  
**File:** `src/lib/verse-detection-workflow.ts:126`

Each detection batch queues items with `Promise.all`. Multiple `handleVerseDetections` calls can overlap if transcript events arrive quickly.

**Failure mode:** queue updates may interleave, causing unexpected order or duplicate flash/update behavior.

**Required action:** verify `queue-store` idempotence under overlapping calls, or serialize detection batch queue mutations.

### F-13 - Misleading comment in `addDetections` merge branch

**Severity:** Low-Medium  
**File:** `src/stores/detection-store.ts:223`

The comment says "Incoming won on confidence" in an `else` branch where the state detection did not win by confidence/direct/recency. The behavior appears intentional, but the comment is easy to misread.

**Failure mode:** future maintainers may alter correct sentinel-preservation behavior based on the wrong explanation.

**Required action:** correct the comment and add a test that targets this branch explicitly.

### F-14 - Theme/settings persistence failures are console-only

**Severity:** Low-Medium  
**Files:** `src/stores/broadcast-store.ts:484`, `src/stores/broadcast-store.ts:516`, `src/stores/settings-store.ts`

Persist/hydrate errors fall back to defaults or fail silently except for console warnings.

**Failure mode:** operator settings or broadcast themes may not persist, and the user may only notice during the next service/session.

**Required action:** surface persistence failure in settings or status strip; avoid silently presenting defaults as successfully loaded.

## Section 1 - Requirements Check

### What exact problem is this code supposed to solve?

SabbathCue is expected to detect Bible references from live transcription, rank/deduplicate detections, queue/preview verses, optionally auto-live them, and render them reliably to projector windows or NDI outputs during live production.

### Is the requirement precise enough to test against?

Partially. The feature goals are clear, but several operational contracts are not precise enough:

- Whether detection batches are guaranteed newest-first.
- Whether the broadcast `enabled` switch means "configured", "preview active", "NDI active", or "any output active".
- Whether monitor selection must survive hotplug/reorder/sleep.
- What operator-visible failure state is required for NDI/projector sync failures.

Because these are vague, the review is **INCOMPLETE for correctness claims**. It can still identify concrete risks.

### Does the code solve the stated requirement or developer assumptions?

It solves the likely happy-path requirement. It also assumes:

- Console warnings are acceptable for live-output failures.
- Array indexes are acceptable monitor identities.
- First direct detection in a batch is the intended preview.
- Local React state is enough to represent output lifecycle.

Those assumptions are not safe for production live operation.

## Section 2 - State and Edge Case Audit

### Detection Store

| State | Handling | Status |
| --- | --- | --- |
| Happy path | Adds, merges, ranks, caps at 8 | Good |
| Missing verse text | Preserves existing text on merge | Good |
| Duplicate execution | Merges equivalent detections | Good |
| Stale data | Uses `received_at`; old detections persist until manual clear | Partial |
| Unresolved zero sentinels | Preserves resolved coordinates | Good |
| Unexpected equivalent refs | Uses structured key or normalized ref | Good |
| Future settings usage | Duplicate settings can go stale | Risk: F-06 |

### Verse Detection Workflow

| State | Handling | Status |
| --- | --- | --- |
| Happy path | Store detections, preview direct hit, queue auto items | Good |
| Missing/failed verse lookup | Falls back silently | Risk: F-11 |
| Multiple direct hits | Uses first direct hit | Risk: F-05 |
| Invalid `book_number` | Skips preview when `book_number <= 0` | Partial |
| Double/overlapping execution | No serialization | Risk: F-12 |

### Broadcast / NDI Settings

| State | Handling | Status |
| --- | --- | --- |
| Start preview | Opens window, reconciles existence | Good |
| Stop preview | Closes and reconciles | Partial |
| Start NDI | Ensures hidden window, starts session | Good |
| NDI SDK missing | Visible toast | Good |
| Double click | No pending guard | Risk: F-09 |
| Dialog reopen | `enabled` and `ndiActive` initialize false | Risk: F-03, F-10 |
| Failed output sync | Console only | Risk: F-01 |
| Failed frame push | Console only | Risk: F-02 |

### Monitor Targeting

| State | Handling | Status |
| --- | --- | --- |
| No monitors | Disables select | Good |
| Index out of range | Clamp on fetch; backend errors if stale | Partial |
| Same count, reordered monitors | No protection | Risk: F-04 |
| Hotplug mid-session | No stable re-resolution | Risk: F-04 |

## Section 3 - Invariant Check

| Invariant | Protected? | Notes |
| --- | --- | --- |
| One ranked entry per canonical verse | Yes | `detectionKey` and equivalence logic |
| Unresolved zero coordinates must not overwrite resolved coordinates | Yes | Covered by tests |
| Operator must know when live output sync fails | No | F-01 |
| Operator must know when NDI frame delivery fails | No | F-02 |
| Output UI state must match actual preview/NDI lifecycle | No | F-03, F-10 |
| Monitor selection must target same physical display | No | F-04 |
| Detection settings must have one source of truth | No | F-06 |
| Manual detection failure must not masquerade as no detections | No | F-07 |
| Backend detection settings must match UI settings | Partial | Sync exists, failure is silent |

## Section 4 - Test Quality Review

### Strong tests

- `src/stores/detection-store.test.ts`: ranking, duplicate merge, direct/semantic source preservation, zero-sentinel preservation, cap at 8, equivalent refs.
- `src/lib/verse-detection-workflow.test.ts`: direct preview, queueing, reading advance, fallback to current chapter.
- `src/hooks/use-broadcast-output-settings.test.ts`: preview/NDI command orchestration.
- `src/lib/broadcast-output-ndi.test.ts`: frame request building, resize behavior, heartbeat scheduling, warning function.

### Weak or missing tests

- No test that broadcast sync failure becomes operator-visible.
- No test that repeated NDI frame failures affect UI/state.
- No test for `enabled` desync after failed disable.
- No test for double-click preview/NDI commands.
- No test for settings dialog reconciling existing NDI status.
- No test for monitor reorder with same monitor count.
- No test proving backend detection batch ordering contract.
- No test that manual `detect_verses` failure is distinguishable from no results.
- No real Tauri/manual test coverage for NDI-to-OBS and multi-monitor hotplug.

### Verification run

Command run:

```text
npm.cmd run test:unit -- src\stores\detection-store.test.ts src\lib\verse-detection-workflow.test.ts src\hooks\use-broadcast-output-settings.test.ts src\lib\broadcast-output-ndi.test.ts
```

Result:

```text
4 test files passed
39 tests passed
```

This confirms the reviewed happy paths and existing unit coverage, but it does not close the failure-safety gaps above.

## Section 5 - Failure Safety Check

| Operation | Failure caught? | Operator-visible? | Safe/recoverable? | Risk |
| --- | --- | --- | --- | --- |
| Open preview | Yes | Yes | Mostly | Low |
| Close preview | Yes | Yes for main close path | Partial | Medium |
| Start NDI | Yes | Yes | Mostly | Low |
| Stop NDI | Yes | Yes | Partial | Medium |
| Broadcast verse/theme sync | Yes | No | No, stale output possible | High |
| NDI config sync | Yes | No | Partial | High |
| NDI frame push | Yes | No | No, frozen output possible | High |
| Manual detect verses | Yes | No | No, failure looks empty | Medium |
| Detection settings sync | Yes | No | No, UI/backend drift possible | Medium |
| Verse lookup during queue | Yes | No | Fallback works, but unlabelled | Low-Medium |
| Theme/settings persistence | Yes | No | Defaults may mislead | Low-Medium |

## Section 6 - Assumption Extraction

| Assumption | Documented? | Runtime validated? | What breaks if wrong |
| --- | --- | --- | --- |
| Incoming detection batches are newest-first | No | No | Wrong preview verse |
| Console warnings are enough for live output failures | No | No | Operator misses stale/frozen output |
| Monitor indexes are stable | No | No | Output targets wrong display |
| `enabled` local state represents real output lifecycle | No | No | UI says off/on incorrectly |
| NDI status changes only through current dialog | No | No | Dialog state drifts |
| Duplicate detection settings remain unused | No | No | Future stale setting bug |
| Failed manual detection should return empty array | No | No | Failure mistaken for no match |
| Persisted themes/settings loading failure can use defaults silently | No | No | Operator loses configuration unexpectedly |

## Section 7 - Verification Layers

| Layer | Status | Notes |
| --- | --- | --- |
| Requirements clearly defined | Partial | Live output contracts are ambiguous |
| TypeScript/type safety enforced | Yes | Does not encode monitor identity or output lifecycle invariants |
| Unit tests | Partial-Good | Strong for detection; weak for failure visibility |
| Integration tests | Partial | IPC mostly mocked |
| Manual real user flow | Missing from this review | Needed for NDI and monitor hotplug |
| Edge case coverage | Partial | Missing output failure/desync tests |
| Code reviewed by second reviewer | Partial | This report is one review pass |
| Performance impact assessed | Missing | NDI base64-per-frame path not load-tested here |
| Rollback/undo plan | Missing | No rollback plan verified |

## Section 8 - Regression Risk

### Existing behavior likely to break from fixes

- Changing monitor identity handling can affect persisted `mainDisplayMonitorIndex` and `altDisplayMonitorIndex`.
- Making `enabled` derived from output state can change current UI expectations.
- Surfacing sync/NDI failures can introduce new status UI or toasts that need throttling.
- Serializing detection queue mutations can change item ordering if current behavior accidentally depends on concurrency.
- Removing duplicate detection settings from `detection-store` can break any hidden consumer of `useDetection().autoMode`.

### Minimal regression test plan

1. Add tests for rejected `emitTo` in `syncBroadcastOutputFor` and NDI config sync.
2. Add tests for repeated `push_ndi_frame` failure and operator-visible status propagation.
3. Add tests for disabling output where `stop_ndi` or `close_broadcast_window` fails.
4. Add tests for settings dialog opening while backend NDI status is already active.
5. Add tests for double-click preview and NDI toggles.
6. Add tests for reversed direct-hit batch ordering, or add a timestamp/rank contract and test it.
7. Add a monitor reorder unit test using same count but different monitor identity.
8. Add a manual test: projector monitor hotplug, sleep/wake, refresh monitors, open output.
9. Add a manual test: NDI to OBS, interrupt sender, confirm operator-visible failure.
10. Add a manual test: persisted theme/settings load failure behavior.

## Prioritized Required Actions

| Priority | Findings | Action |
| --- | --- | --- |
| P0 | F-01, F-02 | Surface projector/NDI sync and frame failures to the operator. |
| P0 | F-03, F-10 | Reconcile output active state from real preview/NDI state. |
| P0 | F-04 | Stop relying on monitor array index as the stable target. |
| P1 | F-05 | Define detection batch ordering, or choose preview by explicit rank/timestamp. |
| P1 | F-06 | Remove or bridge duplicate detection settings. |
| P1 | F-07, F-08 | Make detection command/settings sync failures visible. |
| P2 | F-09 | Add in-flight guards for output commands. |
| P2 | F-11, F-12 | Label verse lookup fallback and assess queue serialization. |
| P3 | F-13, F-14 | Fix misleading comments and persistence failure visibility. |

## Final Summary

```text
REQUIREMENTS CLARITY:    Ambiguous - output lifecycle, monitor identity, and batch ordering are underspecified
EDGE CASES HANDLED:      Partial - detection merge is strong; live-output failure states are weak
INVARIANTS PROTECTED:    Partial - several live-production invariants are not protected
TEST QUALITY:            Partial/Strong - strong unit tests in detection; missing failure-safety tests
FAILURE SAFETY:          Unsafe - projector/NDI failures are console-only
REGRESSION RISK:         High - live output, monitor targeting, NDI state, and preview ordering

VERDICT:
[ ] Safe to merge
[x] Needs changes before merge
[x] Not fully reviewable - requirements must be clarified for final correctness claims

REQUIRED ACTIONS:
1. Add operator-visible health/failure reporting for broadcast sync and NDI frame push.
2. Reconcile output enabled/active state against preview windows and backend NDI status.
3. Replace monitor index targeting with stable monitor identity or robust re-resolution.
4. Define and test incoming detection batch ordering, or stop using array position for preview.
5. Remove duplicate detection settings or make one store explicitly authoritative.
6. Add tests for output command races, failure paths, and UI/backend state drift.
7. Run real manual NDI + multi-monitor hotplug verification before production use.
```

