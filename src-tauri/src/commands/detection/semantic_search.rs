use std::collections::{HashMap, HashSet};
use std::time::Instant;

use serde::Serialize;

use crate::state::AppState;

use super::result::resolve_semantic_verse_id;
use super::{FTS5_CONFIDENCE_DECAY, FTS5_MIN_CONFIDENCE, FTS5_RANK0_CONFIDENCE};

#[derive(Serialize)]
pub struct SemanticSearchResult {
    pub verse_ref: String,
    pub verse_text: String,
    pub book_name: String,
    pub book_number: i32,
    pub chapter: i32,
    pub verse: i32,
    pub similarity: f64,
}

fn dedup_vector_hits(vector_results: Vec<(i64, f64)>) -> Vec<(i64, f64)> {
    let mut best_by_id: HashMap<i64, f64> = HashMap::with_capacity(vector_results.len());
    for (verse_id, similarity) in vector_results {
        if !similarity.is_finite() {
            continue;
        }
        best_by_id
            .entry(verse_id)
            .and_modify(|best| {
                if similarity > *best {
                    *best = similarity;
                }
            })
            .or_insert(similarity);
    }
    best_by_id.into_iter().collect()
}

fn dedup_and_limit_results(
    candidates: Vec<SemanticSearchResult>,
    limit: usize,
) -> Vec<SemanticSearchResult> {
    let mut best_by_ref: HashMap<(i32, i32, i32), SemanticSearchResult> =
        HashMap::with_capacity(candidates.len());
    for candidate in candidates {
        if !candidate.similarity.is_finite() {
            continue;
        }
        let key = (candidate.book_number, candidate.chapter, candidate.verse);
        match best_by_ref.get_mut(&key) {
            Some(existing) if candidate.similarity > existing.similarity => {
                *existing = candidate;
            }
            Some(_) => {}
            None => {
                best_by_ref.insert(key, candidate);
            }
        }
    }

    let mut results: Vec<SemanticSearchResult> = best_by_ref.into_values().collect();
    results.sort_by(|a, b| b.similarity.total_cmp(&a.similarity));
    results.truncate(limit);
    results
}

pub(super) fn run_semantic_search(
    app_state: &AppState,
    query: &str,
    limit: usize,
    vector_results: Vec<(i64, f64)>,
    semantic_ready: bool,
) -> Vec<SemanticSearchResult> {
    let t0 = Instant::now();
    let vector_hit_count = vector_results.len();

    let mut candidates: Vec<SemanticSearchResult> = dedup_vector_hits(vector_results)
        .into_iter()
        .filter_map(|(verse_id, similarity)| {
            resolve_semantic_verse_id(app_state, verse_id).map(|v| SemanticSearchResult {
                verse_ref: format!("{} {}:{}", v.book_name, v.chapter, v.verse),
                verse_text: v.text,
                book_name: v.book_name,
                book_number: v.book_number,
                chapter: v.chapter,
                verse: v.verse,
                similarity,
            })
        })
        .collect();

    let mut fts_count = 0;
    if let Some(ref db) = app_state.bible_db {
        let fts_results = db
            .search_verses_bm25_scoped(query, limit, None)
            .unwrap_or_else(|e| {
                log::warn!("[semantic_search] FTS5/BM25 query failed: {e}");
                Vec::new()
            });
        fts_count = fts_results.len();
        let seen: HashSet<(i32, i32, i32)> = candidates
            .iter()
            .map(|r| (r.book_number, r.chapter, r.verse))
            .collect();

        for (rank, fts) in fts_results.iter().enumerate() {
            if !seen.contains(&(fts.book_number, fts.chapter, fts.verse)) {
                #[expect(clippy::cast_precision_loss, reason = "rank is small")]
                let similarity = FTS5_RANK0_CONFIDENCE - (rank as f64 * FTS5_CONFIDENCE_DECAY);
                if similarity < FTS5_MIN_CONFIDENCE {
                    break;
                }
                if let Ok(Some(v)) = db.get_verse(
                    app_state.active_translation_id,
                    fts.book_number,
                    fts.chapter,
                    fts.verse,
                ) {
                    candidates.push(SemanticSearchResult {
                        verse_ref: format!("{} {}:{}", v.book_name, v.chapter, v.verse),
                        verse_text: v.text,
                        book_name: v.book_name,
                        book_number: v.book_number,
                        chapter: v.chapter,
                        verse: v.verse,
                        similarity,
                    });
                }
            }
        }
    }

    let results = dedup_and_limit_results(candidates, limit);

    log::info!(
        "[DET-SEMANTIC-SEARCH] words={} vector_hits={} fts_hits={} semantic_ready={} active_translation_id={} results={} elapsed={:?}",
        query.split_whitespace().count(),
        vector_hit_count,
        fts_count,
        semantic_ready,
        app_state.active_translation_id,
        results.len(),
        t0.elapsed()
    );

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(book: i32, chapter: i32, verse: i32, similarity: f64) -> SemanticSearchResult {
        SemanticSearchResult {
            verse_ref: format!("Book{book} {chapter}:{verse}"),
            verse_text: format!("text {book}:{chapter}:{verse}"),
            book_name: format!("Book{book}"),
            book_number: book,
            chapter,
            verse,
            similarity,
        }
    }

    #[test]
    fn dedup_vector_hits_keeps_highest_similarity_per_verse_id() {
        let mut deduped = dedup_vector_hits(vec![
            (10, 0.55),
            (20, 0.72),
            (10, 0.88),
            (10, 0.61),
            (30, f64::NAN),
        ]);
        deduped.sort_by_key(|(id, _)| *id);

        assert_eq!(deduped.len(), 2);
        assert_eq!(deduped[0].0, 10);
        assert!((deduped[0].1 - 0.88).abs() < f64::EPSILON);
        assert_eq!(deduped[1].0, 20);
    }

    #[test]
    fn dedup_and_limit_results_dedups_by_ref_and_truncates_merged_total() {
        let merged = vec![
            row(43, 3, 16, 0.61),
            row(43, 3, 16, 0.91),
            row(19, 23, 1, 0.80),
            row(45, 8, 28, 0.75),
            row(1, 1, 1, 0.68),
            row(50, 4, 13, 0.64),
        ];

        let final_results = dedup_and_limit_results(merged, 3);
        assert_eq!(final_results.len(), 3);
        assert_eq!(final_results[0].book_number, 43);
        assert!((final_results[0].similarity - 0.91).abs() < f64::EPSILON);
        assert_eq!(final_results[1].book_number, 19);
        assert_eq!(final_results[2].book_number, 45);
    }
}
