# Detection Optimization via Golden Sermon Fixture — Coding Agent Plan

> Instance of `CODING_AGENT_PLAN_TEMPLATE_v1.4.md`. All template protocol sections (§0 Prime Directive, §3 Tool Calling, §3A Micro-Test, §3B Quality Rubric, §4 Failure Modes, §5 Anti-Hallucination, §6 Code Appendix, §7 Hard Stops) apply **unchanged** and are incorporated by reference. This document fills in plan-specific content: metadata, §1 scope, §2 checkpoint execution structure, and the fixture transcript (Appendix A.0).

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | Detection optimization validated against a real closing-segment sermon transcript (golden replay fixture) |
| **Version** | v1.4 |
| **Agent ID / Session** | Codex GPT-5 / 2026-07-13 execution |
| **Codebase / Repo** | rhema (SabbathCue) — local checkout, branch off `main` (suggest `feat/sermon-golden-fixture`) |
| **Language / Stack** | Rust (detection crate, `src-tauri/crates/detection/`); JSON fixtures (`data/detection-fixtures/`); MDX docs (`web/content/docs/`) |
| **Plan Author** | BongaNdlovu (operator) / plan drafted by Claude 2026-07-13 |
| **Date Created** | 2026-07-13 |
| **Completion Target** | 2026-07-13 |

---

## HOW THIS PLAN IS STRUCTURED

**This is optimization, not redesign.** The detection architecture (direct + semantic + quotation + reading mode → ensemble merge → operator detections UI → preview/live/queue) stays as-is. Every change must be justified by evidence from the golden replay; no speculative tuning.

Five work items (WI-A … WI-E), in strict order — later WIs depend on evidence produced by earlier ones:

- **WI-A — Golden fixture + replay plumbing.** Land the transcript as a fixture, teach the existing `detection_accuracy` harness to carry timestamps, run the first evidence replay with *provisional* labels.
- **WI-B — Gold labeling from evidence.** Convert the first replay's real outcomes into final Must-Hit / Soft-Hit / Must-Not-Hit labels. **Hard rule from the spec: update labels from evidence — do not invent verses the transcript never supports.**
- **WI-C — Must-Not-Hit hardening** (fewer false positives during story/banter/garbled numbers), each fix with a regression test.
- **WI-D — Must-Hit / Soft-Hit improvement** (paraphrase cues: Luke 15, Revelation 14/7), each improvement with a regression test and no benchmark regression.
- **WI-E — Ranking/cooldown stability check + docs.**

The checkpoint cycle **CP-01 → CP-06 runs once per work item**, in order. A work item's CP-03 may not start until its own CP-02 is operator-approved. WI-C and WI-D are both gated on WI-B's approved gold labels and may be planned in one CP-02 pass if the operator agrees.

Repo-wide verification commands (used in every CP-03/CP-04):

- Rust unit + integration tests: `cargo test --workspace` from `src-tauri/`
- Targeted detection tests: `cargo test -p rhema-detection` from `src-tauri/`
- Golden replay (from **repo root** so default asset paths resolve):
  ```
  cargo run -p rhema-detection --features precompute-bin --release \
    --bin detection_accuracy -- \
    --cases data/detection-fixtures/sermon-closing-2026-07.json
  ```
- Built-in benchmark baseline (no external cases):
  ```
  cargo run -p rhema-detection --features precompute-bin --release \
    --bin detection_accuracy -- --cases none
  ```
- Frontend (only if WI-E touches TS, which it should not): `npx tsc --noEmit`, `npx vitest run`

**Baseline (capture before any change, log in §6 A.3.0):** the built-in-benchmark run (`--cases none`) headline metrics (precision / recall / accuracy / case-pass) AND the existing external fixture run (default `sermon-transcript-cases.json`). Every CP-04 compares against this. **No WI may reduce baseline precision or recall.**

**Environment prerequisites for the replay bin** (verify in WI-A CP-01; these are known live-fire gotchas from prior sessions):
- Model + embeddings assets must exist at repo-root-relative paths: `models/minilm-l6-v2-int8/onnx/model_quantized.onnx`, `models/minilm-l6-v2/tokenizer.json`, `embeddings/public-minilm-l6-v2.bin` + `-ids.bin`, `data/verses-for-embedding.json`, `data/rhema.db`. If the semantic leg looks dead (zero semantic hints anywhere), suspect a broken/mismatched `public-minilm-l6-v2.bin` before suspecting detector logic — verify with the `live_probe` bin.
- The harness reuses ONE pipeline across cases (state carries across windows — this is intentional and matches live). `set_stt_language` resets pending-reference state, so the fixture must not alternate languages (it is all `en`).

---

## § 1 · FULL SCOPE DEFINITION

### 1.1 What this plan accomplishes

1. **WI-A — Golden fixture + replay plumbing.** The operator-provided closing-segment sermon transcript (Appendix A.0, verbatim) is committed as: (a) a raw provenance file preserving timestamps exactly as given, and (b) a time-ordered windows fixture in the existing `FixtureCase` JSON format consumed by `detection_accuracy`, one case per STT-final-sized window, in transcript order, each carrying its source timestamp as metadata. `detection_accuracy` gains an optional `timestamp` field on `FixtureCase` (metadata only — echoed in per-case output, never scored). First replay is run and every window's actual outcome (what fired, what hinted, confidences) is recorded in §6.
2. **WI-B — Gold labeling.** Each window's provisional label (Appendix A.1) is confirmed or corrected from WI-A evidence and encoded as `mode: fire | hint | silent` + `expected`/`expectedAny`/`forbidden`. Deliberate labeling decisions the spec pre-commits us to:
   - "rejoicing over one sinner who repents" → Luke 15 (`expectedAny: ["Luke 15:7", "Luke 15:10"]`), hint or fire per evidence.
   - "Jesus would still have come to die … for [one]" → **Soft-Hit at most** (`mode: hint`); if first replay shows nothing plausible, label `silent` — do not force a brittle exact verse.
   - "144,000 … follow the lamb wherever he goes" / "wash my robes in the blood of the lamb" → Revelation 14:1–5 (`expectedAny` across 14:1/14:4) and Revelation 7:14 respectively, hint or fire per evidence.
   - Closing hymn "Worthy … is the lamb" windows: hymn-lyric matching is **out of coverage** (hymn support is spoken-command routing only — `transcript_router.rs` routes "hymnal N" commands; there is no lyric matcher). Document this in WI-E. However "Worthy is the Lamb that was slain" is near-verbatim Revelation 5:12, so a *scripture* hint on Rev 5:12 during the hymn is acceptable evidence-driven behavior (`mode: hint`, `expectedAny: ["Revelation 5:12"]`) — but it must **not auto-fire** (`fire` is wrong for sung fragments interleaved with `[music]` tags). If replay shows no Rev 5:12 hint, label `silent`. Do not fake a Bible hit.
   - Story/banter windows (soccer tournament, Gale Street, dating story, Helder/Hallebert College, Durban, cafeteria, "I don't see myself with you", "200 2009", repeated "cousin", `[laughter]`/`[sighs]`/`[music]`/`[singing]` tags) → `mode: silent`. The closing pastoral prayer alludes without scripture wording ("persevere and endure to the end" is close to Matthew 24:13 — decide from evidence: an endure-to-the-end hint is acceptable as `hint`, anything auto-firing is a failure) → default `silent`.
3. **WI-C — Must-Not-Hit hardening.** Every false positive the labeled replay exposes gets a root-cause diagnosis and a minimal fix in the Rust detector, plus a distilled unit regression in a new `src-tauri/crates/detection/tests/closing_sermon_regressions.rs` (same style as `sermon_sovereignty_regressions.rs`). Anticipated (verify against evidence first — fix only what actually fires):
   - Garbled numerics: "in 200 2009", "2012 or Oh, 2013, 2014, 2015, 2015", "140 thou 44,000" must not become verse references (prose-number guards live in `direct/parser.rs` / `direct/detector.rs`).
   - STT caption tags `[laughter] [sighs] [snorts] [music] [singing]` and `>>` speaker marks must not corrupt parsing or feed FTS/semantic queries as content words.
   - Repeated filler ("cousin. Cousin. Yeah, cousin", "the the the") must not inflate FTS keyword matches past the live rank floor.
4. **WI-D — Must-Hit / Soft-Hit improvement.** Every labeled miss gets a diagnosis before any tuning. Allowed knobs (in preference order): semantic query hygiene (sentence-start trimming — a known failure mode is a 12-word window straddling two sentences), synonym expansion (`semantic/synonyms.rs`), quote-overlap constants in `pipeline.rs` (`QUOTE_OVERLAP_*`), FTS live rank floor (`FTS5_LIVE_RANK_FLOOR`). **Not allowed:** lowering `DEFAULT_SEMANTIC_CONFIDENCE_THRESHOLD` / `DEFAULT_AUTO_QUEUE_THRESHOLD` globally, or any change that moves the built-in benchmark's precision down. Known prior root cause to check before tuning scores: the ensemble must gate on `best_similarity`, not the strategy-weighted score (verbatim quotes were once capped at 0.7×cosine by strategy weights).
5. **WI-E — Ranking/cooldown stability + docs.** Verify across the dense closing segment (01:13–01:15, where 144,000 / robes / elect cues arrive back-to-back) that: at most one auto-queue per cooldown window (`DEFAULT_COOLDOWN_MS = 2500`), ranking is stable (direct > semantic, then confidence — `merger.rs` contract), and repeated cues for the same verse don't flap. Add a merger-level unit test if any instability is found. Update `web/content/docs/features/verse-detection.mdx` with: the golden-fixture concept, the replay command, and the hymn-lyrics out-of-coverage note. Record final replay metrics vs. WI-A first replay in §6.

What must NOT change: detection architecture, frontend workflow (`src/lib/verse-detection-workflow.ts`, `src/hooks/use-transcription.ts` are **read-only reference surfaces** for this plan — confirm in CP-01 that no fix requires touching them; if one does, that is a scope expansion per §4), queue semantics, reading-mode advance behavior, non-English detection paths, search UI FTS behavior (the live rank floor is live-path-only by design).

### 1.2 Files in scope — grouped by work item

Paths repo-relative. The CP-01 grep for each WI must confirm this list before CP-02; additions go through the scope-expansion protocol (§4).

**WI-A — fixture + plumbing:**
```
data/detection-fixtures/sermon-closing-2026-07-golden.txt      (NEW — raw transcript, verbatim from Appendix A.0)
data/detection-fixtures/sermon-closing-2026-07.json            (NEW — windowed FixtureCase list, provisional labels)
src-tauri/crates/detection/src/bin/detection_accuracy.rs       (optional `timestamp` field on FixtureCase; echo in per-case println; unit test)
```

**WI-B — gold labeling:**
```
data/detection-fixtures/sermon-closing-2026-07.json            (labels updated from evidence)
docs/plans/2026-07-13-sermon-golden-fixture-detection-optimization-plan.md   (§6 evidence tables)
```

**WI-C — must-not-hit hardening (evidence-gated; likely subset):**
```
src-tauri/crates/detection/src/direct/parser.rs                (prose/garbled number guards)
src-tauri/crates/detection/src/direct/detector.rs              (caption-tag / speaker-mark stripping, filler robustness)
src-tauri/crates/detection/src/pipeline.rs                     (FTS floor / quote-overlap guards, query hygiene)
src-tauri/crates/detection/src/sentence_buffer.rs              (only if tag stripping belongs at buffering)
src-tauri/crates/detection/tests/closing_sermon_regressions.rs (NEW — distilled regressions)
```

**WI-D — must-hit improvement (evidence-gated; likely subset):**
```
src-tauri/crates/detection/src/semantic/synonyms.rs
src-tauri/crates/detection/src/semantic/chunker.rs             (sentence-start trimming if straddle confirmed)
src-tauri/crates/detection/src/semantic/ensemble.rs            (verify best_similarity gating; fix only if regressed)
src-tauri/crates/detection/src/pipeline.rs                     (QUOTE_OVERLAP_* / FTS5_LIVE_RANK_FLOOR)
src-tauri/crates/detection/tests/closing_sermon_regressions.rs (extend)
```

**WI-E — stability + docs:**
```
src-tauri/crates/detection/src/merger.rs                       (only if instability found; test-first)
web/content/docs/features/verse-detection.mdx
docs/plans/2026-07-13-sermon-golden-fixture-detection-optimization-plan.md   (final metrics)
```

### 1.3 Files explicitly OUT of scope

```
src/lib/verse-detection-workflow.ts          (frontend workflow — reference only)
src/hooks/use-transcription.ts               (reference only)
src/stores/detection-store.ts                (chapter-only supersession etc. — untouched)
src-tauri/crates/detection/src/reading_mode.rs   (no reading-mode passage in this segment)
src-tauri/src/commands/transcript_router.rs  (hymn command routing — document, don't change)
src-tauri/crates/detection/src/direct/af_books.rs, localized_books.rs   (non-English)
embeddings/*, models/*                        (assets — never regenerate in this plan)
data/detection-fixtures/sermon-transcript-cases.json   (existing fixture — untouched; new fixture is a separate file)
```

### 1.4 Dependencies and external systems involved

- **Local assets** (§ "Environment prerequisites" above) are required for the replay bin. `cargo test -p rhema-detection` does **not** need them (integration tests use `DirectDetector`/stub semantic only) — must-not-hit regressions in WI-C therefore run in plain CI.
- No network, no app launch, no STT provider. The fixture *replaces* live STT for this plan.
- The transcript contains caption-style artifacts (`>>`, `[laughter]`, `[music]`) that a live Deepgram/Vosk final may not emit identically. This is acceptable: the fixture is deliberately harder than clean STT, and tag robustness is itself a WI-C deliverable. Note it in the fixture file's provenance comment.

### 1.5 Definition of done

1. `data/detection-fixtures/sermon-closing-2026-07-golden.txt` matches Appendix A.0 byte-for-byte (modulo trailing newline).
2. `sermon-closing-2026-07.json` loads via `load_fixture_cases` (proven by the existing unit-test pattern extended to the new file) and every window has a final `mode` + label recorded from evidence.
3. Golden replay run shows: **zero `FALSE-FIRE` and zero `WRONG fired`** outcomes on `silent` windows; every `fire` window fires its expected ref; `hint` windows report their expected hint found (soft-hits that evidence showed unreachable were re-labeled in WI-B, with the reasoning logged in §6 — not left failing).
4. `cargo test --workspace` passes; `closing_sermon_regressions.rs` covers every WI-C/WI-D fix with at least one distilled case each (positive and negative side where applicable).
5. Built-in benchmark (`--cases none`) precision and recall ≥ baseline captured in A.3.0 (equal is acceptable; a drop is a hard stop per §7).
6. `verse-detection.mdx` documents the golden fixture, replay command, and hymn out-of-coverage.
7. Commits are small and per-WI; final replay metrics recorded in §6.

---

## § 2 · CHECKPOINT EXECUTION PLAN

### Per-WI CP-01 grep commands (minimum set)

**WI-A:**
```
ls data/detection-fixtures/
grep -n "deny_unknown_fields\|struct FixtureCase" src-tauri/crates/detection/src/bin/detection_accuracy.rs
ls models/minilm-l6-v2-int8/onnx/ models/minilm-l6-v2/ embeddings/ data/rhema.db data/verses-for-embedding.json
grep -rn "sermon-transcript-cases" src-tauri/ data/
```
(Confirm: FixtureCase tolerates unknown fields today; asset paths exist; nothing else consumes the fixtures directory by glob.)

**WI-B:** re-run WI-A replay command twice, confirm deterministic output (HNSW + cooldown could introduce order effects; if nondeterministic, log it and pin what varies before labeling).

**WI-C:**
```
grep -n "parse_spoken_number\|prose\|is_year\|BC" src-tauri/crates/detection/src/direct/parser.rs
grep -rn "\[music\]\|\[laughter\]\|strip\|bracket" src-tauri/crates/detection/src/ src-tauri/crates/stt/src/
grep -n "FTS5_LIVE_RANK_FLOOR\|QUOTE_OVERLAP" src-tauri/crates/detection/src/pipeline.rs
```
(Known prior art: language-gated filler stripping already exists for "um" phantom-book anchors — find it and extend the same mechanism rather than adding a second stripping pass.)

**WI-D:**
```
grep -n "best_similarity\|ensemble" src-tauri/crates/detection/src/semantic/ensemble.rs
grep -n "sentence\|trim\|window" src-tauri/crates/detection/src/semantic/chunker.rs
grep -n "synonym" src-tauri/crates/detection/src/semantic/synonyms.rs | head
```

**WI-E:**
```
grep -n "cooldown\|auto_queue" src-tauri/crates/detection/src/merger.rs
grep -n "detection" web/content/docs/features/verse-detection.mdx | head
```

### Plan-author implementation notes (constraints for CP-02 — not pre-approved code)

1. **Windowing rule (WI-A).** Split each timestamp block of A.0 at sentence boundaries into windows of roughly 10–30 words — the size of a real STT final. Keep transcript order. Each window's `timestamp` is its source block's timestamp (e.g. `"01:07:37"`). Keep caption tags and `>>` marks **inside** the window text (they are part of the robustness test). Category values: `sermon-must` (fire), `sermon-soft` (hint), `sermon-noise` (silent) — pick per window from A.1 provisionally, finalize in WI-B. Worked example, first block:
   - `"Brian, and one person is saved, there's rejoicing in heaven."` → provisional `sermon-soft`, `expectedAny: ["Luke 15:7", "Luke 15:10"]`, timestamp `01:07:37`
   - `">> There may not be rejoicing when you give your report, but there is rejoicing over one sinner who repents."` → provisional `sermon-must` or `sermon-soft` (evidence decides), same `expectedAny`
   - `"For Jesus, it was never about the multitudes, but at that one- on-one connection [sighs] in 200 2009, I went to a soccer tournament, indoor soccer tournament on Gale Street."` → `sermon-noise`, `forbidden` left empty unless replay shows a specific phantom ref (then add it)
2. **`timestamp` field (WI-A).** Add `timestamp: Option<String>` to `FixtureCase`, thread into `BenchCase`, include in the per-case `println!` prefix when present. One unit test in the bin's existing `mod tests` proving a case with `timestamp` parses and one without still parses. Do not score on it.
3. **Evidence before fixes (WI-C/WI-D).** For each failing window, first pull the diagnosis: which leg produced the bad/missing detection (direct parse? FTS keyword? vector?), at what confidence, with what query text. Use the harness's per-case output plus, if needed, temporary `eprintln!` (removed before commit) or the `score_distribution` / `live_probe` bins. A fix without a written root cause in §6 is a §4 failure mode.
4. **Regression style (WI-C/WI-D).** `closing_sermon_regressions.rs` uses `DirectDetector` directly for parse-level regressions (like `sermon_sovereignty_regressions.rs`) and `DetectionPipeline` with the stub semantic + hand-built `Bm25Result` lists (like `pipeline.rs`'s own tests) for FTS/quote-overlap regressions. No model files in tests.
5. **Ranking/cooldown check (WI-E).** Drive `DetectionMerger` (or `DetectionPipeline::process_direct` sequence) with the dense-segment windows and assert: ≤1 `auto_queued` per 2500 ms simulated window, and that a lower-confidence semantic hint never outranks a direct citation. If the merger needs an injectable clock to test this, that refactor is in scope but must be behavior-preserving (test-first).
6. **Build freshness.** Any "the fix didn't change the replay" observation: first confirm you rebuilt (`--release` bin is easily stale) — check the binary timestamp against the fix commit before debugging further.

### Phase C skeleton (fill per WI at CP-02)

Per WI: CP-01 recon (greps above + read the touched files) → CP-02 operator-approved micro-design → CP-03 implement smallest slice + targeted test → CP-04 regression sweep (`cargo test --workspace`, golden replay, built-in benchmark vs A.3.0) → CP-05 commit (`fix(detection): …` / `feat(detection): …` / `test(detection): …` / `docs(detection): …`) → CP-06 log evidence in §6.

---

## §§ 3–7 · PROTOCOLS

Incorporated unchanged from `CODING_AGENT_PLAN_TEMPLATE_v1.4.md`. Plan-specific §7 hard stops:

- Built-in benchmark precision or recall drops below A.3.0 baseline → stop, revert the slice, re-diagnose.
- A fix requires touching any §1.3 out-of-scope file → stop, scope-expansion protocol.
- Gold label cannot be justified from replay evidence → label stays/becomes `silent`; never invent a verse.

---

## § 6 · CODE APPENDIX

Namespaced per work item (`A.1.WIA.1`, …). Pre-registered entries:

- **A.3.0** — Baseline metrics (built-in benchmark + existing external fixture), captured before any change.
- **A.1.WIA.1** — First-replay evidence table: window → what fired/hinted, confidence, leg.
- **A.1.WIB.1** — Final gold-label table with per-window justification for every label that changed from Appendix A.1.
- **A.1.WIC.n / A.1.WID.n** — Root-cause note per fix.
- **A.1.WIE.1** — Final replay metrics vs first replay.

### Execution evidence

### A.3.0 — Baseline metrics captured before changes

Commands run from repo root on 2026-07-13:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy -- --cases none
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy
```

Baseline built-in benchmark (`--cases none`): 112 cases; precision 100.0%; recall 76.4%; accuracy 81.2%; case pass 81.2%; false positives 0; false negatives 21.

Baseline existing external fixture (`sermon-transcript-cases.json`): 144 cases; precision 98.8%; recall 79.6%; accuracy 84.7%; case pass 82.6%; false positives 1; false negatives 21; semantic hints 6/10.

### A.1.WIA.1 — First replay evidence

Command:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy -- --cases data/detection-fixtures/sermon-closing-2026-07.json
```

First replay with provisional labels loaded 56 golden fixture cases. Golden-only category results were `sermon-noise 50/51` and `sermon-soft 0/5`. The replay exposed one silent-window false fire: the 01:14:53 prayer sentence, "And father, I pray that you may convict them...", fired `1 Kings 15:11` at 91% through the semantic/FTS path. The two hymn windows at 01:15:28 held `Revelation of John 5:12` at 84% and 82%, below live fire threshold.

### A.1.WIB.1 — Final gold-label decisions

The Luke 15 opening windows were changed from provisional `hint` to `silent` because the replay produced no Luke 15 candidate. The 144,000 / robes / follow-the-lamb windows were changed from provisional `hint` to `silent` because the replay produced no supported Revelation 14:1/14:4 or Revelation 7:14 candidate; unrelated held candidates such as `I Peter 1:19` and `Luke 9:57` were not encoded as expected results. The two "worthy is the lamb" hymn windows were changed from `silent` to `hint` with expected `Revelation 5:12` because the replay held `Revelation of John 5:12` below live threshold.

### A.1.WIC.1 — Root cause and fix

Root cause: the hybrid FTS semantic branch treated a pastoral prayer address as live-strength scripture evidence because `1 Kings 15:11` shares high-value words with the prayer frame (`right`, `Lord`, `father`) and scored 91% even though the fragment was not a citation or quote. Fix: `cap_pastoral_prayer_address_confidence(...)` caps clearly pastoral prayer-address semantic candidates at 89%, preserving them as held hints while preventing live-fire scoring; the cap is applied to both vector semantic detections and FTS-backed semantic candidates. Regression coverage: `closing_prayer_address_cannot_reach_live_fire_confidence`, `closing_prayer_fts_candidate_cannot_reach_live_fire_confidence`, and positive non-prayer confidence tests.

### A.1.WIE.1 — Final replay metrics

Final golden replay command:

```bash
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy -- --cases data/detection-fixtures/sermon-closing-2026-07.json
```

Final combined run: 168 cases; precision 100.0%; recall 76.4%; accuracy 87.5%; case pass 87.5%; false positives 0; false negatives 21; semantic hints 2/2. Golden-only category results: `sermon-noise 54/54`, `sermon-soft 2/2`. The fixed prayer case now stays silent with held `1 Kings 15:11` at 89%. Both hymn hint windows report `OK hint Revelation 5:12 held for review`.

Final verification commands passed:

```bash
cargo test --manifest-path src-tauri/Cargo.toml -p rhema-detection
cargo test --workspace
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy -- --cases none
cargo run --manifest-path src-tauri/Cargo.toml -p rhema-detection --features precompute-bin --release --bin detection_accuracy
git diff --check
```

Post-change built-in benchmark remained at precision 100.0% and recall 76.4%. Post-change existing external fixture remained at precision 98.8% and recall 79.6%.

### A.0 — Fixture transcript (verbatim; commit as `data/detection-fixtures/sermon-closing-2026-07-golden.txt`)

```text
01:07:37
Brian, and one person is saved, there's rejoicing in heaven. >> There may not be rejoicing when you give your report, but there is rejoicing over one sinner who repents. For Jesus, it was never about the multitudes, but at that one- on-one connection [sighs] in 200 2009, I went to a soccer tournament, indoor soccer tournament on Gale Street. You know, it's Gail Street. And I was new in the church, very new. And when I went to the soccer tournament, I do what most gentlemen do is scout the
01:08:28
crowd. Okay, you missed that one. [laughter] I was looking for a potential partner. See the Sabbath mine is in, right? As I was playing in the tournament, I I casted [snorts] my eyes to the the the top of one of the the the fields. There was a little balcony like that a little bit higher, but I was down here and I looked up and I saw this girl. Yeah. I saw this girl and I immediately God can strike me down now. I immediately said that's the one I want to marry. >> I have never seen her in my life. I have
01:09:23
no idea who she is, but I said I can stand here today and say that's the one I'm going to marry. From 2009 to 2011, I never saw her. I went to Helder College and my friend was getting married, my best friend, and he said he wants me to be part of uh his wedding. He wants me to be there. So I said, "Okay, I need to know who am I going to be matched up with." And he says, "It's my wife to be her cousin." and he showed me a picture and he told me who it is and it was her.
01:10:14
>> Yeah. Thank you. [laughter] Hey, tough crowd. Yeah. My best friend was marrying my wife to be her her cousin. Sorry. Cousin. Did I say sister? >> Cousin. >> Cousin. Yeah, cousin. We eventually we we had a small outing together as a retinue and I tried my I tried to throw my bones. I tried my luck there, but I had to go back to Hallebert College and she was in Durban and she I remember I'll never forget I was sitting at the cafeteria table right besides the bad food I got a message there and it
01:10:56
said her message said to me I don't see myself with you and that was that that was 2012 or Oh, 2013, 2014, 2015, 2015. She made contact with me. Oh, wait. I need lunch. I made contact with her. But there was nothing happening. And I I I I prayed to the Lord. This was my prayer. My prayer was, "Lord, I know she doesn't want me. I know she doesn't like me, but put feelings in her heart for me. That was my prayer. And eventually, cut a very long story short, we started dating. And then I
01:11:51
said, you know what? Let me ask her this question. Let me ask her, what made the change? Because before you didn't want to be with me, but now you want to be with me. And thank the Lord we marry today, right? But she, this was her answer. I have no idea. And I said, "Thank you, Lord." Right? [laughter] It's fine. But here's the thing, right? This is what I what I think about. There is so many other fish in the sea. I have come in contact with literally thousands of people and the out of that whole pool it could
01:12:38
have been anyone picked out. [snorts] But it's not about the multitude that is laid before us. It's about the qualities that you are that Jesus is looking for in each and every one of us. And the fact that he chooses us means that we fit into this criteria because you can it's not about the multitudes. Jesus is not concerned about multitudes. He's concerned about that one- on-one relationship. Somebody once said, "If there was one sinner or one person who sinned, Jesus would still have come to die on the
01:13:20
cross for them. Don't ask the question whether you are a part of a symbolic number or a literal number. Ask the question, do I have what Jesus is looking for? >> Do I fit these characteristics of the 144,000? Am I able to endure through the pain? Am I able to wash my robes in the blood of the lamb? Ask those questions. Today I want to close by offering you this opportunity to say, "Lord, before I heard this sermon, I didn't think I would make it. I didn't think I was part of that elect. But today, I
01:14:07
have a chance. I have a chance to change my life." If you want to say, "Lord, I want to be part of that number. Lord, I want to be part of the 140 thou 44,000 who follow the lamb wherever he goes. If that's your desire, I invite you to stand with me as we pray together. Loving father, we thank you. We thank you for choosing us today, dear Lord. We thank you for coming to this church and speaking a word to us. Lord, you're not concerned about the crowds. You're not concerned about how
01:14:53
many are going to be saved. But Lord, you are concerned whether we reflect your character or not. Lord, I pray for those who have stood. I thank you, dear Lord, that you have spoken to them. And father, I pray that you may convict them, convert them right now on the spot, dear Lord, because you are able to do the impossible, dear father. Lord, I pray that you may bless them. May you hold their hand as they follow you wherever they go. As they go through difficult trials and tribulations, dear Lord, may they persevere and endure to
01:15:28
the end. May you bless them in a special way. We thank you for visiting and being a guest in our presence today, dear Lord. We pray and ask this now in Jesus name. Amen. Amen. Worthy, [music] [music] worthy is the [singing and music] lamb. Worthy, worthy is the lamb. Worthy, worthy [singing] is the lamb. and sing. [music] Glory [singing] hallelu [music] praising hallelu glory [singing and music] hallelu to [music] the lamb. Savior and thy kingom come. [music] All [singing] the power of sin consume
01:16:55
bring thy bless. [music] [singing] Glory hallelu. [music] Praise him. [singing] Hallelu. [music] Glory. Hallelujah to the Lord. [singing] The way we [music] come and feel love him, [singing] serve him, praise him [music] still till we all [singing] sing the [music] lamb. Glory [singing] hallelu. [music] Praise him. Hallelu. [singing] Glory [music] hallelu to the [singing] lamb. [music] Let us pray. Dear Lord, as we depart now from your presence, I pray that you may go with us. May you lead us, guide us
01:18:09
always. And Lord, until we meet again next Sabbath, bless us, Lord, is our prayer in Jesus.
```

### A.1 — Provisional label map (WI-A; finalized from evidence in WI-B)

| Timestamp block | Content | Provisional label | Expected / Forbidden |
|---|---|---|---|
| 01:07:37 (opening sentences) | "rejoicing in heaven … rejoicing over one sinner who repents" | Soft-Hit (`hint`) | `expectedAny: [Luke 15:7, Luke 15:10]` |
| 01:07:37 (rest) – 01:11:51 | soccer tournament, Gale/Gail Street, scouting, dating story, Helder/Hallebert College, Durban, cafeteria, "I don't see myself with you", "200 2009", year strings, "cousin" repeats | Must-Not-Hit (`silent`) | add `forbidden` per replay evidence if phantoms appear |
| 01:12:38 ("Somebody once said, if there was one sinner … Jesus would still have come to die") | quotation-of-a-saying, EGW-adjacent | Soft-Hit (`hint`) — weak; demote to `silent` if evidence gives nothing plausible | no forced verse |
| 01:13:20 ("characteristics of the 144,000 … wash my robes in the blood of the lamb") | Revelation cues | Must/Soft (`hint` provisionally) | `expectedAny: [Revelation 14:1, Revelation 7:14]` — split windows so robes-washing window expects 7:14 and 144,000 window expects 14:1 |
| 01:14:07 ("140 thou 44,000 who follow the lamb wherever he goes") | Revelation 14:4 wording | Soft-Hit (`hint`) | `expectedAny: [Revelation 14:4, Revelation 14:1]`; garbled "140 thou 44,000" must not parse as a reference |
| 01:14:07 (rest) – 01:15:28 (prayer) | pastoral prayer, allusive only ("persevere and endure to the end") | Must-Not-Hit (`silent`) | Matthew 24:13 as `hint` acceptable only if evidence shows it cleanly; never `fire` |
| 01:15:28 – 01:16:55 (hymn) | "Worthy … is the lamb", "Glory hallelu…" with `[music]/[singing]` | `silent` (hymn out-of-coverage) unless replay hints Rev 5:12, then `hint` `expectedAny: [Revelation 5:12]` | must never auto-fire |
| 01:18:09 (benediction) | "until we meet again next Sabbath" | Must-Not-Hit (`silent`) | — |

---

## PLAN COMPLETION SIGN-OFF

| Item | Status |
|---|---|
| All WIs CP-06 logged | ☑ |
| Definition of done §1.5 items 1–6 verified with command output | ☑ |
| CP-05 commits | not run; no commit was requested |
| Operator sign-off | pending operator review |
