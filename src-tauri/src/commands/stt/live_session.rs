//! Live STT detection session: direct, semantic, and reading-mode orchestration.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::state::AppState;
use rhema_detection::{DetectionMerger, DirectDetector, ReadingMode};

use super::detection::{
    is_bible_detection_enabled, is_semantic_detection_enabled,
    rebalance_auto_queue_for_digit_growth, refresh_egw_cue_for_surviving_quote,
    RecentDirectEmissions, DIRECT_REPEAT_SUPPRESSION, FINAL_SEMANTIC_MIN_WORDS,
};
use super::detection_jobs::finalize_live_semantic_results;
use super::detection_logic::{
    apply_semantic_reading_scope_with_request_hint, choose_reading_candidate,
    direct_reading_candidates, filter_direct_results_to_scope_if_present,
    live_pause_out_of_scope_bible_book, should_release_stale_reading_scope,
    should_restart_reading, spoken_book_hint, strip_reference_scaffolding,
    strong_out_of_scope_bible_book, DirectReadingCandidate, READING_SCOPE_RELEASE_STREAK,
};
use super::utils::{transcript_logging_enabled, truncate_safe};
use crate::commands::detection::apply_presentation_grant;
fn active_reading_bible_scope(app: &AppHandle) -> Option<(i32, i32, String, u64)> {
    let reading_mode_state: State<'_, Mutex<ReadingMode>> = app.state();
    let Ok(reading_mode) = reading_mode_state.lock() else {
        log::warn!("[DET-SEMANTIC] ReadingMode busy; semantic scope filter skipped");
        return None;
    };

    if !reading_mode.is_active() {
        return None;
    }

    let book_number = reading_mode.current_book();
    let chapter = reading_mode.current_chapter();
    if book_number <= 0 || chapter <= 0 {
        return None;
    }

    Some((
        book_number,
        chapter,
        reading_mode.current_book_name().to_string(),
        reading_mode.seconds_since_last_match(),
    ))
}

fn pause_stale_reading_scope(app: &AppHandle) {
    let reading_mode_state: State<'_, Mutex<ReadingMode>> = app.state();
    if let Ok(mut reading_mode) = reading_mode_state.lock() {
        reading_mode.pause();
    };
}

fn note_out_of_scope_hit(app: &AppHandle, book_number: i32, chapter: i32) -> u32 {
    let reading_mode_state: State<'_, Mutex<ReadingMode>> = app.state();
    let streak = match reading_mode_state.lock() {
        Ok(mut reading_mode) => reading_mode.note_out_of_scope_hit(book_number, chapter),
        Err(_) => 0,
    };
    streak
}

fn filter_live_semantic_results_to_reading_scope(
    app: &AppHandle,
    results: Vec<crate::commands::detection::DetectionResult>,
    semantic_min_confidence: f64,
    transcript: &str,
    request_hint: bool,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter, book_name, stale_secs)) = active_reading_bible_scope(app)
    else {
        return results;
    };

    let is_verse_request = request_hint || rhema_detection::looks_like_verse_request(transcript);

    if !is_verse_request {
        if should_release_stale_reading_scope(
            &results,
            book_number,
            chapter,
            stale_secs,
            semantic_min_confidence,
        ) {
            log::info!(
                "[DET-SEMANTIC] Releasing stale reading scope {book_name} {chapter} \
             ({stale_secs}s since last verse match; out-of-scope semantic hit)"
            );
            pause_stale_reading_scope(app);
            return results;
        }

        if let Some((hit_book, hit_chapter)) = live_pause_out_of_scope_bible_book(
            &results,
            book_number,
            chapter,
            stale_secs,
            semantic_min_confidence,
        ) {
            let streak = note_out_of_scope_hit(app, hit_book, hit_chapter);
            if streak >= READING_SCOPE_RELEASE_STREAK {
                log::info!(
                    "[DET-SEMANTIC] Releasing reading scope {book_name} {chapter} \
                     ({stale_secs}s since last verse match; {streak} repeated out-of-scope hits on {hit_book}:{hit_chapter})"
                );
                pause_stale_reading_scope(app);
                return results;
            }
        } else if let Some((hit_book, hit_chapter)) =
            strong_out_of_scope_bible_book(&results, book_number, chapter)
        {
            let streak = note_out_of_scope_hit(app, hit_book, hit_chapter);
            if streak >= READING_SCOPE_RELEASE_STREAK {
                log::info!(
                    "[DET-SEMANTIC] Releasing reading scope {book_name} {chapter} \
                     ({streak} consecutive strong hits on {hit_book}:{hit_chapter})"
                );
                pause_stale_reading_scope(app);
                return results;
            }
        }
    }

    let before = results.len();
    let results = apply_semantic_reading_scope_with_request_hint(
        results,
        Some((book_number, chapter)),
        transcript,
        request_hint,
    );
    let suppressed = before.saturating_sub(results.len());
    if suppressed > 0 {
        log::info!(
            "[DET-SEMANTIC] Suppressed {suppressed} out-of-scope Bible result(s) while reading {book_name} {chapter}"
        );
    } else if is_verse_request
        && results.iter().any(|result| {
            result.content_type == "bible"
                && (result.book_number != book_number || result.chapter != chapter)
        })
    {
        log::info!(
            "[DET-SEMANTIC] Verse request; keeping out-of-scope Bible result(s) while reading {book_name} {chapter}"
        );
    }

    results
}

fn filter_live_direct_results_to_reading_scope(
    app: &AppHandle,
    results: Vec<crate::commands::detection::DetectionResult>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter, book_name, _)) = active_reading_bible_scope(app) else {
        return results;
    };

    let before = results.len();
    let results = filter_direct_results_to_scope_if_present(results, Some((book_number, chapter)));
    let suppressed = before.saturating_sub(results.len());
    if suppressed > 0 {
        log::info!(
            "[DET-DIRECT] Suppressed {suppressed} out-of-scope Bible result(s) while reading {book_name} {chapter}"
        );
    }

    results
}

fn mark_egw_auto_queue(
    app: &AppHandle,
    results: &mut [crate::commands::detection::DetectionResult],
) {
    let merger_state: State<'_, Mutex<DetectionMerger>> = app.state();
    let Ok(mut merger) = merger_state.lock() else {
        for result in results {
            result.auto_queued = false;
        }
        log::warn!("[DET-EGW] DetectionMerger busy; EGW auto-queue skipped");
        return;
    };
    crate::commands::detection::apply_egw_auto_queue(results, &mut merger);
}

fn emit_egw_direct_detections(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
) {
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        if transcript_logging_enabled() {
            log::debug!("[DET-EGW] AppState busy; skipping direct EGW detection");
        }
        return;
    };
    let mut results = crate::commands::detection::detect_egw_references(&app_state, transcript);
    drop(app_state);

    if results.is_empty() || seq < latest_seq.load(Ordering::Acquire) {
        return;
    }

    mark_egw_auto_queue(app, &mut results);
    for result in &results {
        log::info!(
            "[DET-EGW] Found: {} ({:.0}%) auto_q={}",
            result.verse_ref,
            result.confidence * 100.0,
            result.auto_queued
        );
    }
    let _ = app.emit("verse_detections", &results);
}

fn detect_live_egw_quotes(
    app: &AppHandle,
    egw_cue_at_ms: &AtomicU64,
    transcript: &str,
    stt_confidence: f64,
) -> (Vec<crate::commands::detection::DetectionResult>, bool) {
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let (mut results, cue_active, now_ms) = if let Ok(app_state) = app_managed.lock() {
        let books = app_state
            .bible_db
            .as_ref()
            .and_then(|db| db.list_egw_books().ok())
            .unwrap_or_default();
        if books.is_empty() {
            (Vec::new(), false, 0)
        } else {
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |elapsed| {
                    u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX)
                });
            let cue_active = crate::commands::detection::note_and_check_egw_cue(
                &books,
                transcript,
                now_ms,
                egw_cue_at_ms,
            );
            let quotes =
                crate::commands::detection::detect_egw_quotes(&app_state, transcript, cue_active);
            (quotes, cue_active, now_ms)
        }
    } else {
        log::warn!("[DET-EGW-QUOTE] AppState busy; skipping EGW quote pass");
        (Vec::new(), false, 0)
    };

    crate::commands::detection::dampen_egw_for_low_stt_confidence(&mut results, stt_confidence);
    crate::commands::detection::retain_best_egw_quote(&mut results);
    refresh_egw_cue_for_surviving_quote(egw_cue_at_ms, now_ms, cue_active, &results);
    mark_egw_auto_queue(app, &mut results);
    (results, cue_active)
}

static LEDGER: std::sync::OnceLock<Mutex<rhema_detection::EvidenceLedger>> =
    std::sync::OnceLock::new();

pub fn reset_evidence_ledger() {
    if let Some(ledger) = LEDGER.get() {
        if let Ok(mut l) = ledger.lock() {
            l.reset();
        }
    }
}

pub(crate) fn is_automation_live_enabled(app: &AppHandle) -> bool {
    let state: State<'_, Mutex<AppState>> = app.state();
    let enabled = match state.lock() {
        Ok(s) => {
            s.auto_mode.load(Ordering::Relaxed) && s.live_output_enabled.load(Ordering::Relaxed)
        }
        Err(_) => false,
    };
    enabled
}

fn note_independent_finals(verse_key: &str, utterance_id: Option<u64>, is_final: bool) -> u32 {
    if !is_final {
        return 0;
    }
    let Some(utterance_id) = utterance_id else {
        return 1;
    };
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| {
            u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX)
        });
    let ledger = LEDGER.get_or_init(|| Mutex::new(rhema_detection::EvidenceLedger::default()));
    match ledger.lock() {
        Ok(mut ledger) => ledger.note_final(verse_key, utterance_id, now_ms),
        Err(poisoned) => poisoned
            .into_inner()
            .note_final(verse_key, utterance_id, now_ms),
    }
}

fn authorize_unmatched_results(
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    transcript: &str,
    request_hint: bool,
    is_final_utterance: bool,
    utterance_id: Option<u64>,
    automation_live_enabled: bool,
) {
    for result in results.iter_mut() {
        let grant = rhema_detection::decide_presentation(&rhema_detection::PresentationEvidence {
            job: if result.source == "direct" {
                rhema_detection::DetectionJob::Citation
            } else if request_hint || rhema_detection::looks_like_verse_request(transcript) {
                rhema_detection::DetectionJob::Request
            } else {
                rhema_detection::DetectionJob::Quotation
            },
            source_is_direct: result.source == "direct",
            is_chapter_only: result.is_chapter_only,
            is_fuzzy_book: result.is_fuzzy_book,
            is_complete_citation: result.source == "direct"
                && !result.is_chapter_only
                && !result.is_fuzzy_book
                && result.book_number > 0
                && result.chapter > 0
                && result.verse > 0,
            is_final_utterance,
            has_lexical_quote: result.has_lexical_quote,
            quote_coverage: 0.0,
            candidate_margin: 1.0,
            independent_final_count: note_independent_finals(
                &result.verse_ref,
                utterance_id,
                is_final_utterance,
            ),
            automation_live_enabled,
        });
        apply_presentation_grant(result, grant, is_final_utterance, utterance_id);
    }
    retain_rejected_bible_results(results);
}

fn authorize_emitted_results(
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    detections: &[rhema_detection::Detection],
    transcript: &str,
    request_hint: bool,
    is_final_utterance: bool,
    utterance_id: Option<u64>,
    automation_live_enabled: bool,
) {
    if detections.is_empty() {
        authorize_unmatched_results(
            results,
            transcript,
            request_hint,
            is_final_utterance,
            utterance_id,
            automation_live_enabled,
        );
        return;
    }

    let semantic_margin = {
        let mut semantic: Vec<f64> = results
            .iter()
            .filter(|result| result.source.starts_with("semantic"))
            .map(|result| result.confidence)
            .collect();
        semantic.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        if semantic.len() >= 2 {
            semantic[0] - semantic[1]
        } else {
            1.0
        }
    };

    for result in results.iter_mut() {
        let matched_detection = detections.iter().find(|d| {
            d.verse_ref.book_number == result.book_number
                && d.verse_ref.chapter == result.chapter
                && d.verse_ref.verse_start == result.verse
        });

        let (quote_coverage, candidate_margin) = if let Some(d) = matched_detection {
            (
                d.quote_coverage,
                if matches!(d.source, rhema_detection::DetectionSource::Semantic { .. }) {
                    semantic_margin
                } else {
                    1.0
                },
            )
        } else {
            (0.0, 1.0)
        };

        let grant = rhema_detection::decide_presentation(&rhema_detection::PresentationEvidence {
            job: if result.source == "direct" {
                rhema_detection::DetectionJob::Citation
            } else if request_hint || rhema_detection::looks_like_verse_request(transcript) {
                rhema_detection::DetectionJob::Request
            } else {
                rhema_detection::DetectionJob::Quotation
            },
            source_is_direct: result.source == "direct",
            is_chapter_only: result.is_chapter_only,
            is_fuzzy_book: result.is_fuzzy_book,
            is_complete_citation: result.source == "direct"
                && !result.is_chapter_only
                && !result.is_fuzzy_book
                && result.book_number > 0
                && result.chapter > 0
                && result.verse > 0,
            is_final_utterance,
            has_lexical_quote: result.has_lexical_quote,
            quote_coverage,
            candidate_margin,
            independent_final_count: note_independent_finals(
                &result.verse_ref,
                utterance_id,
                is_final_utterance,
            ),
            automation_live_enabled,
        });
        apply_presentation_grant(result, grant, is_final_utterance, utterance_id);
    }
    retain_rejected_bible_results(results);
}

fn retain_rejected_bible_results(results: &mut Vec<crate::commands::detection::DetectionResult>) {
    results.retain(|result| {
        result.content_type == "egw"
            || result.authorization != rhema_detection::PresentationDecision::Reject
    });
}

fn retain_results_allowed_by_bible_mode(
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    bible_detection_enabled: bool,
) {
    if !bible_detection_enabled {
        results.retain(|result| result.content_type != "bible");
    }
}

fn log_direct_found(
    result: &crate::commands::detection::DetectionResult,
    transcript: &str,
    suffix: &str,
) {
    let suffix = if suffix.is_empty() {
        String::new()
    } else {
        format!(" {suffix}")
    };
    if transcript_logging_enabled() {
        log::info!(
            "[DET-DIRECT] Found: {} ({:.0}%) chapter_only={} auto_q={} snip={:?} text={:?}{suffix}",
            result.verse_ref,
            result.confidence * 100.0,
            result.is_chapter_only,
            result.auto_queued,
            result.transcript_snippet,
            truncate_safe(transcript, 80),
        );
    } else {
        log::info!(
            "[DET-DIRECT] Found: {} ({:.0}%) chapter_only={} auto_q={} snip={:?}{suffix}",
            result.verse_ref,
            result.confidence * 100.0,
            result.is_chapter_only,
            result.auto_queued,
            result.transcript_snippet,
        );
    }
}

fn detections_from_merged(
    merged: &[rhema_detection::MergedDetection],
) -> Vec<rhema_detection::Detection> {
    merged
        .iter()
        .map(|merged| merged.detection.clone())
        .collect()
}

fn authorize_suppress_log_direct(
    app: &AppHandle,
    transcript: &str,
    is_final_transcript: bool,
    merged: &[rhema_detection::MergedDetection],
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    recent: &std::sync::OnceLock<Mutex<RecentDirectEmissions>>,
    log_suffix: &str,
) {
    authorize_emitted_results(
        results,
        &detections_from_merged(merged),
        transcript,
        false,
        is_final_transcript,
        None,
        is_automation_live_enabled(app),
    );
    suppress_repeat_direct_emissions(recent, results, is_final_transcript);
    for result in results.iter() {
        log_direct_found(result, transcript, log_suffix);
    }
}

#[expect(
    clippy::too_many_arguments,
    reason = "latest-wins fallback keeps seq, transcript, and merger payload explicit"
)]
fn fallback_direct_without_db(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
    is_final_transcript: bool,
    merged: &[rhema_detection::MergedDetection],
    recent: &std::sync::OnceLock<Mutex<RecentDirectEmissions>>,
    reading_candidates: Vec<DirectReadingCandidate>,
) -> Vec<DirectReadingCandidate> {
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-DIRECT] Skipping stale emission in fallback path seq={seq}");
        return Vec::new();
    }
    if !is_bible_detection_enabled(app) {
        return Vec::new();
    }
    let results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| {
            let vr = &m.detection.verse_ref;
            crate::commands::detection::DetectionResult {
                content_type: "bible".to_string(),
                verse_ref: format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start),
                verse_text: String::new(),
                book_name: vr.book_name.clone(),
                book_number: vr.book_number,
                chapter: vr.chapter,
                verse: vr.verse_start,
                confidence: m.detection.confidence,
                rank_score: m.detection.rank_score(),
                source: "direct".to_string(),
                auto_queued: m.auto_queued,
                transcript_snippet: m.detection.transcript_snippet.clone(),
                is_chapter_only: m.detection.is_chapter_only,
                ..crate::commands::detection::DetectionResult::default()
            }
        })
        .collect();
    let mut results = filter_live_direct_results_to_reading_scope(app, results);
    authorize_suppress_log_direct(
        app,
        transcript,
        is_final_transcript,
        merged,
        &mut results,
        recent,
        "(no DB)",
    );
    let _ = app.emit("verse_detections", &results);
    reading_candidates
}

#[expect(
    clippy::too_many_arguments,
    reason = "direct emit keeps seq, finality, and timing together"
)]
fn emit_fresh_direct(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
    is_final_transcript: bool,
    t0: std::time::Instant,
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    mut reading_candidates: Vec<DirectReadingCandidate>,
) -> Vec<DirectReadingCandidate> {
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-DIRECT] Skipping emission for stale seq={seq}");
        return Vec::new();
    }
    log::info!(
        "[DET-TRACE] seq={seq} decision=direct emitted={} top={} is_final={} took={:?}",
        results.len(),
        results.first().map_or("-", |r| r.verse_ref.as_str()),
        is_final_transcript,
        t0.elapsed()
    );
    if !is_bible_detection_enabled(app) {
        retain_results_allowed_by_bible_mode(results, false);
        reading_candidates.clear();
    }
    if results.is_empty() {
        return reading_candidates;
    }
    let _ = app.emit("verse_detections", results.as_slice());
    if transcript_logging_enabled() {
        log::info!(
            "[DET-DIRECT] Detection took {:?} for {:?}",
            t0.elapsed(),
            truncate_safe(transcript, 50)
        );
    } else {
        log::info!("[DET-DIRECT] Detection took {:?}", t0.elapsed());
    }
    reading_candidates
}

fn suppress_repeat_direct_emissions(
    slot: &std::sync::OnceLock<Mutex<RecentDirectEmissions>>,
    results: &mut Vec<crate::commands::detection::DetectionResult>,
    is_final_transcript: bool,
) {
    if results.is_empty() {
        return;
    }
    let guard = slot.get_or_init(|| Mutex::new(RecentDirectEmissions::default()));
    let mut recent = match guard.lock() {
        Ok(recent) => recent,
        Err(poisoned) => {
            log::error!("[DET-DIRECT] Repeat-suppression lock poisoned; recovering");
            poisoned.into_inner()
        }
    };
    if is_final_transcript {
        recent.suppress_repeats_final(
            results,
            DIRECT_REPEAT_SUPPRESSION,
            std::time::Instant::now(),
        );
    } else {
        recent.suppress_repeats(
            results,
            DIRECT_REPEAT_SUPPRESSION,
            std::time::Instant::now(),
        );
    }
}

fn detect_merge_direct(
    app: &AppHandle,
    transcript: &str,
) -> Option<(Vec<rhema_detection::MergedDetection>, f64)> {
    let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
    let mut detector = match detector_state.lock() {
        Ok(d) => d,
        Err(e) => {
            log::error!("Failed to lock DirectDetector: {e}");
            return None;
        }
    };
    let direct_results = detector.detect(transcript);
    drop(detector);
    if direct_results.is_empty() {
        return Some((Vec::new(), 0.0));
    }
    let merger_state: State<'_, Mutex<DetectionMerger>> = app.state();
    let mut detection_merger = match merger_state.lock() {
        Ok(m) => m,
        Err(e) => {
            log::error!("Failed to lock DetectionMerger: {e}");
            return None;
        }
    };
    let auto_queue_threshold = detection_merger.auto_queue_threshold();
    let merged = detection_merger.merge(direct_results, vec![]);
    Some((merged, auto_queue_threshold))
}

pub(crate) fn run_direct_detection(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
    is_final_transcript: bool,
) -> Vec<DirectReadingCandidate> {
    static LOCK_OK: AtomicU64 = AtomicU64::new(0);
    static LOCK_CONTENDED: AtomicU64 = AtomicU64::new(0);
    static RECENT_DIRECT: std::sync::OnceLock<Mutex<RecentDirectEmissions>> =
        std::sync::OnceLock::new();

    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-DIRECT] Skipping stale job seq={seq}");
        return Vec::new();
    }
    if !is_bible_detection_enabled(app) {
        emit_egw_direct_detections(app, seq, latest_seq, transcript);
        return Vec::new();
    }
    let t0 = std::time::Instant::now();
    let Some((merged, auto_queue_threshold)) = detect_merge_direct(app, transcript) else {
        return Vec::new();
    };

    if merged.is_empty() {
        emit_egw_direct_detections(app, seq, latest_seq, transcript);
        return Vec::new();
    }
    let reading_candidates = direct_reading_candidates(&merged, is_final_transcript);

    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        let bad = LOCK_CONTENDED.fetch_add(1, Ordering::Relaxed) + 1;
        let good = LOCK_OK.load(Ordering::Relaxed);
        log::warn!("[DET-DIRECT] AppState lock FAILED (contention) ok={good} contended={bad}");
        return fallback_direct_without_db(
            app,
            seq,
            latest_seq,
            transcript,
            is_final_transcript,
            &merged,
            &RECENT_DIRECT,
            reading_candidates,
        );
    };
    let ok = LOCK_OK.fetch_add(1, Ordering::Relaxed) + 1;
    if ok.is_multiple_of(50) {
        let bad = LOCK_CONTENDED.load(Ordering::Relaxed);
        log::info!("[DET-DIRECT] AppState lock stats ok={ok} contended={bad}");
    }
    let mut results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        .collect();
    rebalance_auto_queue_for_digit_growth(&mut results, auto_queue_threshold, is_final_transcript);
    let egw_start = results.len();
    results.extend(crate::commands::detection::detect_egw_references(
        &app_state, transcript,
    ));
    drop(app_state);
    if results.len() > egw_start {
        mark_egw_auto_queue(app, &mut results[egw_start..]);
    }
    let mut results = filter_live_direct_results_to_reading_scope(app, results);
    authorize_suppress_log_direct(
        app,
        transcript,
        is_final_transcript,
        &merged,
        &mut results,
        &RECENT_DIRECT,
        "",
    );
    emit_fresh_direct(
        app,
        seq,
        latest_seq,
        transcript,
        is_final_transcript,
        t0,
        &mut results,
        reading_candidates,
    )
}

fn emit_explicit_egw_window(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
) -> bool {
    let mut egw_explicit = {
        let app_managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(app_state) = app_managed.lock() else {
            log::error!("[DET-SEMANTIC] AppState lock failed for EGW window catch");
            return true;
        };
        crate::commands::detection::detect_egw_references(&app_state, transcript)
    };
    if egw_explicit.is_empty() {
        return false;
    }
    if seq < latest_seq.load(Ordering::Acquire) {
        return true;
    }
    mark_egw_auto_queue(app, &mut egw_explicit);
    for r in &egw_explicit {
        log::info!(
            "[DET-TRACE] seq={seq} decision=egw_explicit reason=window_reference {} ({:.0}%) auto_q={}",
            r.verse_ref,
            r.confidence * 100.0,
            r.auto_queued
        );
    }
    let _ = app.emit("verse_detections", &egw_explicit);
    true
}

fn emit_egw_cue_fast_path(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    egw_quotes: &[crate::commands::detection::DetectionResult],
    cue_live: bool,
    t0: std::time::Instant,
) -> bool {
    if is_bible_detection_enabled(app) && !cue_live {
        return false;
    }
    if egw_quotes.is_empty() {
        log::info!(
            "[DET-TRACE] seq={seq} decision={} emitted=0 elapsed={:?}",
            if cue_live {
                "egw_cue_fast_none"
            } else {
                "bible_mode_off_none"
            },
            t0.elapsed()
        );
        return true;
    }
    if seq < latest_seq.load(Ordering::Acquire) {
        log::info!(
            "[DET-SEMANTIC] Skipping emission for stale seq={seq} (egw_ready={})",
            egw_quotes.len()
        );
        return true;
    }
    for r in egw_quotes {
        log::info!(
            "[DET-SEMANTIC] Found: {} ({:.0}% {}) auto_q={}",
            r.verse_ref,
            r.confidence * 100.0,
            r.source,
            r.auto_queued
        );
    }
    let _ = app.emit("verse_detections", egw_quotes);
    log::info!(
        "[DET-TRACE] seq={seq} decision={} emitted={} top={} ({:.0}%) elapsed={:?}",
        if cue_live {
            "egw_cue_fast"
        } else {
            "bible_mode_off"
        },
        egw_quotes.len(),
        egw_quotes.first().map_or("-", |r| r.verse_ref.as_str()),
        egw_quotes.first().map_or(0.0, |r| r.confidence) * 100.0,
        t0.elapsed()
    );
    true
}

#[expect(
    clippy::too_many_arguments,
    reason = "live semantic detection coordinates stale checks, explicit EGW routing, and emission in one pipeline"
)]
pub(crate) fn run_semantic_detection(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    egw_cue_at_ms: &AtomicU64,
    transcript: &str,
    egw_transcript: &str,
    stt_confidence: f64,
    is_final: bool,
    utterance_id: u64,
    request_hint: bool,
) {
    if !is_semantic_detection_enabled(app) {
        log::debug!("[DET-SEMANTIC] Skipping job seq={seq}; semantic detection disabled");
        return;
    }

    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-SEMANTIC] Skipping stale job seq={seq}");
        return;
    }

    if emit_explicit_egw_window(app, seq, latest_seq, transcript) {
        return;
    }

    let t0 = std::time::Instant::now();
    let (egw_quotes, cue_active) =
        detect_live_egw_quotes(app, egw_cue_at_ms, egw_transcript, stt_confidence);
    let cue_live =
        cue_active || crate::commands::detection::egw_cue_is_currently_live(egw_cue_at_ms);
    if cue_live {
        pause_stale_reading_scope(app);
        log::info!(
            "[DET-EGW-QUOTE] cue_active={cue_active} cue_live=true quotes={} path=pre_hybrid",
            egw_quotes.len()
        );
    }

    if emit_egw_cue_fast_path(app, seq, latest_seq, &egw_quotes, cue_live, t0) {
        return;
    }

    emit_hybrid_semantic(
        app,
        seq,
        latest_seq,
        transcript,
        egw_transcript,
        stt_confidence,
        is_final,
        utterance_id,
        request_hint,
        egw_quotes,
        t0,
    );
}

#[expect(
    clippy::too_many_arguments,
    reason = "hybrid emit keeps the live worker payload explicit"
)]
fn emit_hybrid_semantic(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
    egw_transcript: &str,
    stt_confidence: f64,
    is_final: bool,
    utterance_id: u64,
    request_hint: bool,
    mut egw_quotes: Vec<crate::commands::detection::DetectionResult>,
    t0: std::time::Instant,
) {
    let query = strip_reference_scaffolding(transcript);
    if query.split_whitespace().count() < FINAL_SEMANTIC_MIN_WORDS {
        log::debug!("[DET-TRACE] seq={seq} skip=semantic reason=scaffolding_only");
        return;
    }

    let Some((merged, semantic_min_confidence, fts_len)) =
        run_hybrid_pipeline(app, seq, transcript, &query, t0)
    else {
        return;
    };

    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        log::error!("Failed to lock AppState for verse resolution");
        return;
    };

    let results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        .collect();

    drop(app_state);
    let results = filter_live_semantic_results_to_reading_scope(
        app,
        results,
        semantic_min_confidence,
        transcript,
        request_hint,
    );
    let pre_floor_candidates = results.clone();
    let mut results = finalize_live_semantic_results(results, semantic_min_confidence);
    authorize_emitted_results(
        &mut results,
        &merged
            .iter()
            .map(|merged| merged.detection.clone())
            .collect::<Vec<_>>(),
        transcript,
        request_hint,
        is_final,
        Some(utterance_id),
        is_automation_live_enabled(app),
    );
    if stt_confidence > 0.0 && stt_confidence < 0.65 {
        for result in &mut results {
            result.rank_score *= 0.85;
            result.confidence = result.confidence.min(0.89);
        }
    }

    let rescued_verse = crate::commands::detection::drop_egw_quotes_echoing_scripture(
        &mut egw_quotes,
        &results,
        &pre_floor_candidates,
        egw_transcript,
        false,
    );
    if let Some(verse) = rescued_verse {
        results.push(verse);
    }
    if !egw_quotes.is_empty() {
        egw_quotes.append(&mut results);
        results = egw_quotes;
    }

    if !is_bible_detection_enabled(app) {
        retain_results_allowed_by_bible_mode(&mut results, false);
    }

    emit_semantic_batch(
        app,
        seq,
        latest_seq,
        results,
        fts_len,
        merged.len(),
        t0,
    );
}

fn emit_semantic_batch(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    mut results: Vec<crate::commands::detection::DetectionResult>,
    fts_len: usize,
    candidate_len: usize,
    t0: std::time::Instant,
) {
    if results.is_empty() {
        log::info!(
            "[DET-TRACE] seq={seq} decision=semantic_none emitted=0 fts_hits={fts_len} candidates={candidate_len}"
        );
        return;
    }
    if seq < latest_seq.load(Ordering::Acquire) {
        log::info!(
            "[DET-SEMANTIC] Skipping emission for stale seq={seq} results={}",
            results.len()
        );
        return;
    }
    latest_seq.fetch_max(seq, Ordering::AcqRel);
    for r in &results {
        log::info!(
            "[DET-SEMANTIC] Found: {} ({:.0}% {}) auto_q={} auth={}",
            r.verse_ref,
            r.confidence * 100.0,
            r.source,
            r.auto_queued,
            r.authorization.as_str()
        );
    }
    if !is_bible_detection_enabled(app) {
        retain_results_allowed_by_bible_mode(&mut results, false);
    }
    if results.is_empty() {
        return;
    }
    let _ = app.emit("verse_detections", &results);
    log::info!(
        "[DET-TRACE] seq={seq} decision=semantic_fuzzy emitted={} top={} ({:.0}%)",
        results.len(),
        results.first().map_or("-", |r| r.verse_ref.as_str()),
        results.first().map_or(0.0, |r| r.confidence) * 100.0
    );
    log::info!("[DET-SEMANTIC] Total: {:?}", t0.elapsed());
}

fn run_hybrid_pipeline(
    app: &AppHandle,
    seq: u64,
    transcript: &str,
    query: &str,
    t0: std::time::Instant,
) -> Option<(Vec<rhema_detection::MergedDetection>, f64, usize)> {
    let book_hint = spoken_book_hint(transcript);
    if transcript_logging_enabled() {
        log::info!("[DET-SEMANTIC] Running on: {:?}", truncate_safe(query, 80));
    } else {
        log::info!("[DET-SEMANTIC] Running");
    }
    let (fts_results, active_translation_id) = {
        let managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(app_state) = managed.lock() else {
            log::error!("Failed to lock AppState for FTS5");
            return None;
        };
        (
            app_state
                .bible_db
                .as_ref()
                .and_then(|db| db.search_verses_bm25_scoped(query, 10, book_hint).ok()),
            app_state.active_translation_id,
        )
    };
    let fts = fts_results.unwrap_or_default();
    if fts.is_empty() {
        log::debug!("[DET-SEMANTIC] No FTS5 results, trying vector-only search");
    } else if let Some(top) = fts.first() {
        log::debug!(
            "[DET-SEMANTIC] FTS5 hits={} top={} {}:{} rank={:.3}",
            fts.len(),
            top.book_name,
            top.chapter,
            top.verse,
            top.rank
        );
    }
    let (merged, semantic_ready, paraphrase_enabled, semantic_min_confidence) = {
        let pipeline_state: State<'_, Mutex<rhema_detection::DetectionPipeline>> = app.state();
        let Ok(mut pipeline) = pipeline_state.lock() else {
            log::error!("Failed to lock DetectionPipeline");
            return None;
        };
        let semantic_ready = pipeline.has_semantic();
        let paraphrase_enabled = pipeline.use_synonyms();
        let semantic_min_confidence = pipeline.semantic_confidence_threshold();
        let merged = pipeline.process_hybrid_with_fts(query, &fts);
        (
            merged,
            semantic_ready,
            paraphrase_enabled,
            semantic_min_confidence,
        )
    };
    log::info!(
        "[DET-SEMANTIC] Workflow seq={} words={} fts_hits={} vector_ready={} paraphrase={} active_translation_id={} candidates={} elapsed={:?}",
        seq,
        transcript.split_whitespace().count(),
        fts.len(),
        semantic_ready,
        paraphrase_enabled,
        active_translation_id,
        merged.len(),
        t0.elapsed()
    );
    for (idx, m) in merged.iter().take(5).enumerate() {
        log::info!(
            "[DET-SEMANTIC] candidate[{idx}] {} {}:{}:{:?} conf={:.2} src={:?}",
            m.detection.verse_ref.book_name,
            m.detection.verse_ref.chapter,
            m.detection.verse_ref.verse_start,
            m.detection.verse_id,
            m.detection.confidence,
            m.detection.source
        );
    }
    Some((merged, semantic_min_confidence, fts.len()))
}

fn restart_reading_from_direct(
    app: &AppHandle,
    transcript: &str,
    direct_candidates: &[DirectReadingCandidate],
) -> bool {
    use rhema_detection::ReadingMode;
    if direct_candidates.is_empty() {
        return true;
    }
    let active_scope = {
        let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
        rm_managed.lock().ok().and_then(|rm| {
            if rm.is_active() || rm.has_verses() {
                Some((rm.current_book(), rm.current_chapter()))
            } else {
                None
            }
        })
    };
    let Some(candidate) = choose_reading_candidate(direct_candidates, active_scope) else {
        return true;
    };
    let recent = candidate.verse_ref.clone();
    let should_start = {
        let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
        match rm_managed.lock() {
            Ok(rm) => should_restart_reading(
                rm.is_active(),
                rm.current_book(),
                rm.current_chapter(),
                rm.current_verse(),
                &candidate,
            ),
            Err(_) => false,
        }
    };
    if !should_start {
        return true;
    }
    let t_db = std::time::Instant::now();
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        log::error!("[READING] AppState lock poisoned");
        return false;
    };
    let chapter_data = app_state.bible_db.as_ref().and_then(|db| {
        db.get_chapter(
            app_state.active_translation_id,
            recent.book_number,
            recent.chapter,
        )
        .ok()
    });
    log::info!("[READING] get_chapter took {:?}", t_db.elapsed());
    drop(app_state);
    let Some(chapter_verses) = chapter_data else {
        return true;
    };
    let verses: Vec<(i32, String)> = chapter_verses
        .into_iter()
        .map(|v| (v.verse, v.text))
        .collect();
    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
    if let Ok(mut rm) = rm_managed.lock() {
        rm.start(
            recent.book_number,
            &recent.book_name,
            recent.chapter,
            recent.verse_start,
            verses,
        );
        let lower = transcript.to_lowercase();
        if lower.contains("chapter")
            && !lower.contains("verse")
            && !lower.contains("next")
            && !lower.contains("previous")
        {
            rm.set_expecting_chapter();
        }
    }
    true
}

fn apply_chapter_navigation(app: &AppHandle, transcript: &str) -> Option<bool> {
    use rhema_detection::ReadingMode;
    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
    let chapter_change = {
        let Ok(mut rm) = rm_managed.lock() else {
            return Some(false);
        };
        if !rm.is_active() && !rm.has_verses() {
            None
        } else {
            if transcript_logging_enabled() {
                log::info!("[READING] Checking chapter command for: {transcript:?}");
            }
            rm.check_chapter_command(transcript)
        }
    };
    let change = chapter_change?;
    let t_db = std::time::Instant::now();
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        log::error!("[READING] AppState lock poisoned (chapter nav)");
        return Some(false);
    };
    let chapter_data = app_state.bible_db.as_ref().and_then(|db| {
        db.get_chapter(
            app_state.active_translation_id,
            change.book_number,
            change.new_chapter,
        )
        .ok()
    });
    log::info!("[READING] get_chapter (nav) took {:?}", t_db.elapsed());
    drop(app_state);
    let chapter_verses = chapter_data?;
    if chapter_verses.is_empty() {
        return None;
    }
    let start_verse = change.start_verse.unwrap_or(1);
    let start_verse_text = chapter_verses
        .iter()
        .find(|v| v.verse == start_verse)
        .map_or_else(|| chapter_verses[0].text.clone(), |v| v.text.clone());
    let verses: Vec<(i32, String)> = chapter_verses
        .into_iter()
        .map(|v| (v.verse, v.text))
        .collect();
    if let Ok(mut rm) = rm_managed.lock() {
        rm.start(
            change.book_number,
            &change.book_name,
            change.new_chapter,
            start_verse,
            verses,
        );
    }
    if !change.emit_start_verse {
        log::info!(
            "[READING] Chapter context moved to {} {}; waiting for verse before UI emit",
            change.book_name,
            change.new_chapter
        );
        return Some(true);
    }
    let reference = format!(
        "{} {}:{}",
        change.book_name, change.new_chapter, start_verse
    );
    let advance = rhema_detection::ReadingAdvance {
        book_number: change.book_number,
        book_name: change.book_name.clone(),
        chapter: change.new_chapter,
        verse: start_verse,
        verse_text: start_verse_text,
        reference,
        confidence: 1.0,
    };
    let _ = app.emit("reading_mode_verse", &advance);
    Some(true)
}

fn emit_reading_transcript_advance(app: &AppHandle, transcript: &str) -> bool {
    use rhema_detection::ReadingMode;
    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
    let advance = {
        let Ok(mut rm) = rm_managed.lock() else {
            return false;
        };
        if !rm.is_active() && !rm.has_verses() {
            return false;
        }
        rm.check_transcript(transcript)
    };
    if let Some(advance) = advance {
        let _ = app.emit("reading_mode_verse", &advance);
        return true;
    }
    false
}

pub(crate) fn check_reading_mode(
    app: &AppHandle,
    transcript: &str,
    direct_candidates: Vec<DirectReadingCandidate>,
) -> bool {
    if !restart_reading_from_direct(app, transcript, &direct_candidates) {
        return false;
    }
    if let Some(handled) = apply_chapter_navigation(app, transcript) {
        return handled;
    }
    emit_reading_transcript_advance(app, transcript)
}

#[cfg(test)]
mod bible_mode_tests {
    use super::retain_results_allowed_by_bible_mode;
    use crate::commands::detection::DetectionResult;

    fn result(content_type: &str) -> DetectionResult {
        DetectionResult {
            content_type: content_type.to_string(),
            verse_ref: "reference".to_string(),
            verse_text: "text".to_string(),
            book_name: "book".to_string(),
            book_number: 1,
            chapter: 1,
            verse: 1,
            confidence: 1.0,
            rank_score: 1.0,
            source: "direct".to_string(),
            auto_queued: false,
            transcript_snippet: "spoken words".to_string(),
            is_chapter_only: false,
            ..DetectionResult::default()
        }
    }

    #[test]
    fn bible_mode_off_filters_bible_but_preserves_egw_results() {
        let mut results = vec![result("bible"), result("egw")];

        retain_results_allowed_by_bible_mode(&mut results, false);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content_type, "egw");
    }

    #[test]
    fn bible_mode_on_preserves_all_detection_results() {
        let mut results = vec![result("bible"), result("egw")];

        retain_results_allowed_by_bible_mode(&mut results, true);

        assert_eq!(results.len(), 2);
    }
}
