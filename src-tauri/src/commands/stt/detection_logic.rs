//! Stateless detection helpers used by the live STT loop.

use rhema_detection::{
    decide_presentation, MergedDetection, PresentationEvidence, PresentationGrant, VerseRef,
};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct DirectReadingCandidate {
    pub(crate) verse_ref: VerseRef,
    pub(crate) confidence: f64,
    pub(crate) is_chapter_only: bool,
}

pub(crate) fn clamp_to_recent_words(text: &str, max_words: usize) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    let start = words.len().saturating_sub(max_words);
    words[start..].join(" ")
}

pub(crate) const SENTENCE_TRIM_MIN_WORDS: usize = 6;

pub(crate) fn trim_to_sentence_start(text: &str, min_words: usize) -> String {
    let mut current = text.trim();
    while let Some(idx) = current.find(['.', '?', '!']) {
        let rest = current[idx + 1..].trim_start();
        if rest.split_whitespace().count() < min_words {
            break;
        }
        current = rest;
    }
    current.to_string()
}

pub(crate) fn strip_reference_scaffolding(text: &str) -> String {
    let text = if rhema_detection::looks_like_verse_request(text) {
        let lower = text.to_ascii_lowercase();
        [
            "says",
            "talks about",
            "talk about",
            "speaks about",
            "speak about",
        ]
        .iter()
        .find_map(|marker| {
            lower
                .find(marker)
                .map(|start| text[start + marker.len()..].trim_start_matches(|c: char| {
                    !c.is_alphanumeric()
                }))
        })
        .unwrap_or(text)
    } else {
        text
    };

    let tokens: Vec<&str> = text.split_whitespace().collect();
    let cores: Vec<String> = tokens
        .iter()
        .map(|t| {
            t.trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase()
        })
        .collect();
    let mut out: Vec<&str> = Vec::new();
    for (i, token) in tokens.iter().enumerate() {
        let core = cores[i].as_str();
        if core.is_empty() {
            continue;
        }
        let digits: String = core.chars().filter(|c| !matches!(c, ',' | '.')).collect();
        let is_number = !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit());
        let prev = i.checked_sub(1).map(|p| cores[p].as_str());
        let next = cores.get(i + 1).map(String::as_str);
        let is_scaffold = matches!(
            core,
            "chapter" | "chapters" | "verse" | "verses" | "hoofstuk" | "hoofstukke" | "vers"
        ) || (core == "it" && next == Some("says"))
            || (core == "says" && prev == Some("it"));
        if !is_number && !is_scaffold {
            out.push(token);
        }
    }
    out.join(" ")
}

/// Book number when the window names exactly one book without a complete
/// chapter:verse reference. Returns `None` when no book is named, when several
/// are (e.g. "Malachi … Esther …"), or when a complete reference is present —
/// complete refs are owned by the direct path.
///
/// Uses `BookMatcher` + `parse_reference`, not `DirectDetector::detect`: bare
/// book names are held incomplete and never emitted as detections
/// (`direct/detector.rs` incomplete-ref path).
pub(crate) fn spoken_book_hint(transcript: &str) -> Option<i32> {
    use std::sync::OnceLock;

    use rhema_detection::direct::automaton::BookMatcher;
    use rhema_detection::direct::parser::parse_reference;

    static MATCHER: OnceLock<BookMatcher> = OnceLock::new();
    let matches = MATCHER.get_or_init(BookMatcher::new).find_books(transcript);
    if matches.is_empty() {
        return None;
    }
    let mut books: Vec<i32> = matches.iter().map(|m| m.book_number).collect();
    books.sort_unstable();
    books.dedup();
    if books.len() != 1 {
        return None;
    }
    let book = books[0];
    let lower = transcript.to_ascii_lowercase();
    if matches.iter().any(|book_match| {
        book_match.book_number == book
            && lower
                .get(book_match.end..)
                .is_some_and(|tail| tail.trim_start().starts_with("the baptist"))
    }) {
        return None;
    }
    for book_match in &matches {
        if let Some(vr) = parse_reference(transcript, book_match) {
            if vr.verse_start > 0 {
                return None;
            }
        }
    }
    Some(book)
}

/// True when the transcript window is an explicit scripture reference or a
/// voice/reading command that the direct + command paths already handle.
///
/// Live semantic (fuzzy) search defers to those paths for such utterances, so
/// the detections panel reflects what was actually spoken instead of keyword
/// noise from BM25 matching on reference words like "chapter"/"verse".
pub(crate) fn transcript_defers_to_direct(text: &str) -> bool {
    if rhema_detection::is_voice_command_utterance(text) {
        return true;
    }
    if rhema_detection::looks_like_verse_request(text) {
        return false;
    }
    crate::commands::transcript_router::looks_like_complete_reference(text)
}

pub(crate) fn is_direct_reading_handoff(
    detection: &rhema_detection::Detection,
    is_final_utterance: bool,
) -> bool {
    citation_grant(detection, is_final_utterance).may_start_reading()
}

pub(crate) fn citation_grant(
    detection: &rhema_detection::Detection,
    is_final_utterance: bool,
) -> PresentationGrant {
    grant_for_detection(detection, "", is_final_utterance, 1, false, 1.0)
}

pub(crate) fn grant_for_detection(
    detection: &rhema_detection::Detection,
    transcript: &str,
    is_final_utterance: bool,
    independent_final_count: u32,
    automation_live_enabled: bool,
    candidate_margin: f64,
) -> PresentationGrant {
    let source_is_direct = matches!(
        detection.source,
        rhema_detection::DetectionSource::DirectReference
    );
    let looks_like_request = rhema_detection::looks_like_verse_request(transcript);
    let job = rhema_detection::classify_job(
        source_is_direct,
        looks_like_request,
        detection.has_lexical_quote,
    );
    decide_presentation(&PresentationEvidence {
        job,
        source_is_direct,
        is_chapter_only: detection.is_chapter_only,
        is_fuzzy_book: detection.is_fuzzy_book,
        is_complete_citation: detection.is_complete_citation(),
        is_final_utterance,
        has_lexical_quote: detection.has_lexical_quote,
        quote_coverage: detection.quote_coverage,
        candidate_margin,
        independent_final_count,
        automation_live_enabled,
    })
}

pub(crate) fn verse_digits_could_grow(verse: i32) -> bool {
    (1..=9).contains(&verse)
}

pub(crate) fn is_digit_prefix_extension(shorter: i32, longer: i32) -> bool {
    if shorter <= 0 || longer <= shorter {
        return false;
    }
    let short_text = shorter.to_string();
    let long_text = longer.to_string();
    long_text.starts_with(&short_text) && long_text.len() > short_text.len()
}

pub(crate) fn direct_reading_candidates(
    merged: &[MergedDetection],
    is_final_utterance: bool,
) -> Vec<DirectReadingCandidate> {
    let candidates: Vec<DirectReadingCandidate> = merged
        .iter()
        .filter(|merged| is_direct_reading_handoff(&merged.detection, is_final_utterance))
        .map(|merged| DirectReadingCandidate {
            verse_ref: merged.detection.verse_ref.clone(),
            confidence: merged.detection.confidence,
            is_chapter_only: merged.detection.is_chapter_only,
        })
        .collect();

    candidates
        .iter()
        .filter(|candidate| {
            if candidate.is_chapter_only {
                return true;
            }
            let verse = candidate.verse_ref.verse_start;
            !candidates.iter().any(|other| {
                !other.is_chapter_only
                    && other.verse_ref.book_number == candidate.verse_ref.book_number
                    && other.verse_ref.chapter == candidate.verse_ref.chapter
                    && is_digit_prefix_extension(verse, other.verse_ref.verse_start)
            })
        })
        .cloned()
        .collect()
}

pub(crate) fn choose_reading_candidate(
    candidates: &[DirectReadingCandidate],
    active_scope: Option<(i32, i32)>,
) -> Option<DirectReadingCandidate> {
    let rank = |candidate: &DirectReadingCandidate| -> (u8, i32) {
        let provisional = u8::from(
            !candidate.is_chapter_only && verse_digits_could_grow(candidate.verse_ref.verse_start),
        );
        (provisional, -candidate.verse_ref.verse_start)
    };

    let pick_best = |pool: &[DirectReadingCandidate]| -> Option<DirectReadingCandidate> {
        pool.iter().min_by_key(|candidate| rank(candidate)).cloned()
    };

    if let Some((book_number, chapter)) = active_scope {
        let same_chapter: Vec<_> = candidates
            .iter()
            .filter(|candidate| {
                candidate.verse_ref.book_number == book_number
                    && candidate.verse_ref.chapter == chapter
            })
            .cloned()
            .collect();
        if let Some(candidate) = pick_best(&same_chapter) {
            return Some(candidate);
        }

        let same_book: Vec<_> = candidates
            .iter()
            .filter(|candidate| candidate.verse_ref.book_number == book_number)
            .cloned()
            .collect();
        if let Some(candidate) = pick_best(&same_book) {
            return Some(candidate);
        }
    }

    pick_best(candidates)
}

/// Same-book growable verses wait; a named different book may restart on verse 1.
pub(crate) fn should_restart_reading(
    active: bool,
    current_book: i32,
    current_chapter: i32,
    current_verse: Option<i32>,
    candidate: &DirectReadingCandidate,
) -> bool {
    let recent = &candidate.verse_ref;

    if !active {
        if candidate.is_chapter_only {
            return false;
        }
        if verse_digits_could_grow(recent.verse_start) {
            return false;
        }
        return candidate.confidence >= 0.90;
    }

    if current_book == recent.book_number && current_chapter == recent.chapter {
        if candidate.is_chapter_only {
            return false;
        }
        if verse_digits_could_grow(recent.verse_start) {
            return false;
        }
        return match current_verse {
            Some(current) => recent.verse_start > current,
            None => true,
        };
    }

    if current_book != recent.book_number {
        if candidate.is_chapter_only {
            return false;
        }
        return candidate.confidence >= 0.90;
    }

    if !candidate.is_chapter_only && verse_digits_could_grow(recent.verse_start) {
        return false;
    }
    true
}

pub(crate) const READING_SCOPE_STALE_SECS: u64 = 20;

pub(crate) const READING_SCOPE_LIVE_PAUSE_SECS: u64 = 6;

pub(crate) const READING_SCOPE_RELEASE_MIN_CONFIDENCE: f64 = 0.85;

pub(crate) fn should_release_stale_reading_scope(
    results: &[crate::commands::detection::DetectionResult],
    scope_book_number: i32,
    scope_chapter: i32,
    seconds_since_last_verse_match: u64,
    min_confidence: f64,
) -> bool {
    seconds_since_last_verse_match >= READING_SCOPE_STALE_SECS
        && out_of_scope_bible_book(results, scope_book_number, scope_chapter, min_confidence)
            .is_some()
}

pub(crate) fn live_pause_out_of_scope_bible_book(
    results: &[crate::commands::detection::DetectionResult],
    scope_book_number: i32,
    scope_chapter: i32,
    seconds_since_last_verse_match: u64,
    min_confidence: f64,
) -> Option<(i32, i32)> {
    if seconds_since_last_verse_match < READING_SCOPE_LIVE_PAUSE_SECS {
        return None;
    }

    out_of_scope_bible_book(results, scope_book_number, scope_chapter, min_confidence)
}

pub(crate) const READING_SCOPE_RELEASE_STREAK: u32 = 2;

pub(crate) fn out_of_scope_bible_book(
    results: &[crate::commands::detection::DetectionResult],
    scope_book_number: i32,
    scope_chapter: i32,
    min_confidence: f64,
) -> Option<(i32, i32)> {
    results
        .iter()
        .find(|result| {
            result.content_type == "bible"
                && (result.book_number != scope_book_number || result.chapter != scope_chapter)
                && result.confidence >= min_confidence
        })
        .map(|result| (result.book_number, result.chapter))
}

pub(crate) fn strong_out_of_scope_bible_book(
    results: &[crate::commands::detection::DetectionResult],
    scope_book_number: i32,
    scope_chapter: i32,
) -> Option<(i32, i32)> {
    out_of_scope_bible_book(
        results,
        scope_book_number,
        scope_chapter,
        READING_SCOPE_RELEASE_MIN_CONFIDENCE,
    )
}

pub(crate) fn filter_semantic_results_to_reading_scope(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter)) = scope else {
        return results;
    };

    results
        .into_iter()
        .filter(|result| {
            result.content_type != "bible"
                || (result.book_number == book_number && result.chapter == chapter)
        })
        .collect()
}

/// Apply the reading-chapter semantic filter, except when the operator is
/// asking to leave the chapter ("go to the verse that talks about…").
#[cfg(test)]
pub(crate) fn apply_semantic_reading_scope(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
    transcript: &str,
) -> Vec<crate::commands::detection::DetectionResult> {
    apply_semantic_reading_scope_with_request_hint(results, scope, transcript, false)
}

/// Apply the reading scope while preserving request intent detected from a
/// wider rolling window. The searchable transcript is intentionally trimmed,
/// so relying on it alone can turn "there's a verse that says ..." into an
/// ordinary quotation and suppress a valid result from the active chapter.
pub(crate) fn apply_semantic_reading_scope_with_request_hint(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
    transcript: &str,
    request_hint: bool,
) -> Vec<crate::commands::detection::DetectionResult> {
    if request_hint || rhema_detection::looks_like_verse_request(transcript) {
        return results;
    }
    filter_semantic_results_to_reading_scope(results, scope)
}

pub(crate) fn filter_direct_results_to_scope_if_present(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter)) = scope else {
        return results;
    };

    let has_active_match = results.iter().any(|result| {
        result.content_type == "bible"
            && result.book_number == book_number
            && result.chapter == chapter
    });
    if !has_active_match {
        return results;
    }

    results
        .into_iter()
        .filter(|result| {
            result.content_type != "bible"
                || (result.book_number == book_number && result.chapter == chapter)
        })
        .collect()
}
