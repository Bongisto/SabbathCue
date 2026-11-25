use aho_corasick::{AhoCorasick, MatchKind};

use super::af_books::AF_BOOKS;
use super::books::BOOKS;
use super::localized_books::{ES_BOOKS, FR_BOOKS, PT_BOOKS};

/// A match of a Bible book name found in text.
#[derive(Debug, Clone)]
pub struct BookMatch {
    pub book_number: i32,
    pub book_name: String,
    pub start: usize,
    pub end: usize,
}

/// Aho-Corasick-based matcher for Bible book names, abbreviations, and aliases.
pub struct BookMatcher {
    automaton: Option<AhoCorasick>,
    /// Maps each pattern index to its (`book_number`, `canonical_name`).
    pattern_map: Vec<(i32, String)>,
}

impl Default for BookMatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl BookMatcher {
    /// Build the automaton from all book names, abbreviations, and aliases.
    pub fn new() -> Self {
        Self::for_stt_language("en")
    }

    /// Build a matcher for the given STT language (`en` or `af`).
    pub fn for_stt_language(language: &str) -> Self {
        let books: &[super::books::BookInfo] = match language {
            "af" => AF_BOOKS,
            "es" => ES_BOOKS,
            "fr" => FR_BOOKS,
            "pt" => PT_BOOKS,
            _ => BOOKS,
        };
        Self::from_books(books)
    }

    fn from_books(books: &[super::books::BookInfo]) -> Self {
        // Spoken transcripts contain only full words, so ultra-short patterns
        // ("Is", "Ps", "Re", "Co", …) never represent a spoken book name — they
        // only collide with everyday words and fabricate references. Require at
        // least this many characters for abbreviations and aliases. Every
        // canonical book name is longer than this, so all books stay detectable.
        const MIN_PATTERN_LEN: usize = 3;

        let mut patterns: Vec<String> = Vec::new();
        let mut pattern_map: Vec<(i32, String)> = Vec::new();

        for book in books {
            let name_lower = book.name.to_lowercase();
            // Short canonical names like Portuguese "Jó" (2 chars) still allow
            // equally short variants while keeping 2-letter abbreviations of
            // longer book names ("Ps", "Re", "Jo" for João) filtered out.
            let min_len = MIN_PATTERN_LEN.min(name_lower.chars().count());

            // Add the canonical name
            patterns.push(name_lower.clone());
            pattern_map.push((book.number, book.name.to_string()));

            // Add the abbreviation (if different from name and long enough)
            let abbr_lower = book.abbreviation.to_lowercase();
            if abbr_lower != name_lower && abbr_lower.chars().count() >= min_len {
                patterns.push(abbr_lower.clone());
                pattern_map.push((book.number, book.name.to_string()));
            }

            // Add all aliases
            for alias in book.aliases {
                let alias_lower = alias.to_lowercase();
                // Avoid duplicates with name and abbreviation, and skip patterns
                // too short to be a spoken book name.
                if alias_lower != name_lower
                    && alias_lower != abbr_lower
                    && alias_lower.chars().count() >= min_len
                {
                    patterns.push(alias_lower);
                    pattern_map.push((book.number, book.name.to_string()));
                }
            }
        }

        let automaton = match AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .match_kind(MatchKind::Standard)
            .build(&patterns)
        {
            Ok(automaton) => Some(automaton),
            Err(error) => {
                log::error!("Failed to build Aho-Corasick book matcher: {error}");
                None
            }
        };

        BookMatcher {
            automaton,
            pattern_map,
        }
    }

    /// Find all Bible book name matches in the given text.
    ///
    /// Results are filtered so that only matches occurring at Unicode word
    /// boundaries are returned, and overlapping matches are resolved in favor
    /// of the longest. Returned `start`/`end` byte offsets index `text`.
    pub fn find_books(&self, text: &str) -> Vec<BookMatch> {
        let Some(automaton) = &self.automaton else {
            return Vec::new();
        };
        let (text_lower, offset_map) = lowercase_with_orig_offsets(text);
        let mut raw_matches: Vec<BookMatch> = Vec::new();

        // Use overlapping iterator to get ALL possible matches,
        // including longer patterns that share a start position with shorter ones.
        let mut state = aho_corasick::automaton::OverlappingState::start();
        loop {
            automaton.find_overlapping(&text_lower, &mut state);
            let Some(mat) = state.get_match() else {
                break;
            };

            let idx = mat.pattern().as_usize();
            let (book_number, ref book_name) = self.pattern_map[idx];
            let Some(orig_start) = offset_map.get(mat.start()).copied().flatten() else {
                continue;
            };
            let Some(orig_end) = offset_map.get(mat.end()).copied().flatten() else {
                continue;
            };

            // Check Unicode word boundary at start and end on original text.
            if text[..orig_start]
                .chars()
                .next_back()
                .is_some_and(char::is_alphanumeric)
            {
                continue;
            }
            if text[orig_end..]
                .chars()
                .next()
                .is_some_and(char::is_alphanumeric)
            {
                continue;
            }

            raw_matches.push(BookMatch {
                book_number,
                book_name: book_name.clone(),
                start: orig_start,
                end: orig_end,
            });
        }

        // Resolve overlapping matches: prefer the longest match.
        // Sort by start position, then by length descending.
        raw_matches.sort_by(|a, b| {
            a.start
                .cmp(&b.start)
                .then_with(|| (b.end - b.start).cmp(&(a.end - a.start)))
        });

        let mut result: Vec<BookMatch> = Vec::new();
        let mut last_end: usize = 0;

        for m in raw_matches {
            if m.start >= last_end {
                last_end = m.end;
                result.push(m);
            }
        }

        result
    }
}

/// Lowercase `text` while recording a mapping from every original character's
/// start boundary in the lowered UTF-8 string back to its UTF-8 byte index in
/// `text`. Entries strictly inside a multi-byte or multi-char expansion (such
/// as Turkish `'İ'` -> `"i\u{307}"`) are `None`, guaranteeing every mapped
/// boundary is a valid UTF-8 char boundary in `text`.
fn lowercase_with_orig_offsets(text: &str) -> (String, Vec<Option<usize>>) {
    let mut lower = String::with_capacity(text.len());
    let mut map = Vec::with_capacity(text.len() + 1);
    for (orig_start, ch) in text.char_indices() {
        let lower_start = lower.len();
        for lc in ch.to_lowercase() {
            lower.push(lc);
        }
        if lower.len() > lower_start {
            map.push(Some(orig_start));
            map.resize(lower.len(), None);
        }
    }
    map.push(Some(text.len()));
    (lower, map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_john() {
        let matcher = BookMatcher::new();
        let found_books = matcher.find_books("Jesus said in John 3:16");
        assert_eq!(found_books.len(), 1);
        assert_eq!(found_books[0].book_name, "John");
        assert_eq!(found_books[0].book_number, 43);
    }

    #[test]
    fn test_find_psalm() {
        let matcher = BookMatcher::new();
        let found_books = matcher.find_books("David in Psalm thirty two");
        assert_eq!(found_books.len(), 1);
        assert_eq!(found_books[0].book_name, "Psalms");
    }

    #[test]
    fn test_find_numbered_book() {
        let matcher = BookMatcher::new();
        let found_books = matcher.find_books("Paul wrote in 1 Corinthians 13");
        assert_eq!(found_books.len(), 1);
        assert_eq!(found_books[0].book_name, "1 Corinthians");
    }

    #[test]
    fn two_letter_patterns_are_not_registered() {
        // Spoken transcripts only contain full words, so ultra-short book
        // patterns ("Ps", "Re", "Co", "Da", "Ne", …) never represent a spoken
        // book — they only collide with everyday tokens and fabricate refs.
        let matcher = BookMatcher::new();
        for text in [
            "read the ps now",
            "re run that",
            "the co leader",
            "da plan is good",
            "we will ne over it",
        ] {
            assert!(
                matcher.find_books(text).is_empty(),
                "unexpected book match in {text:?}: {:?}",
                matcher.find_books(text)
            );
        }
    }

    #[test]
    fn full_book_names_still_match_after_min_length_filter() {
        let matcher = BookMatcher::new();
        for (text, book) in [
            ("Psalms 23", "Psalms"),
            ("Revelation 1", "Revelation"),
            ("Colossians 1", "Colossians"),
            ("Daniel 7", "Daniel"),
            ("Job 1", "Job"),
        ] {
            let found = matcher.find_books(text);
            assert!(
                found.iter().any(|m| m.book_name == book),
                "expected {book} in {text:?}: {found:?}"
            );
        }
    }

    #[test]
    fn unicode_case_expansion_turkish_i_keeps_original_byte_offsets() {
        let matcher = BookMatcher::new();
        let text = "İ John 3:16";
        let found = matcher.find_books(text);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].book_name, "John");
        assert_eq!(&text[found[0].start..found[0].end], "John");
    }

    #[test]
    fn unicode_word_boundary_blocks_accented_substrings() {
        let es_matcher = BookMatcher::for_stt_language("es");
        assert!(
            es_matcher.find_books("Dios está aquí").is_empty(),
            "trailing accented letter 'á' must count as part of the word 'está'"
        );

        let fr_matcher = BookMatcher::for_stt_language("fr");
        assert!(
            fr_matcher.find_books("sa colère est grande").is_empty(),
            "leading/trailing non-ASCII word chars and removed 'Est' alias must not match Esther"
        );
    }

    #[test]
    fn portuguese_canonical_jo_is_indexed_with_original_offsets() {
        let matcher = BookMatcher::for_stt_language("pt");
        let text = "Leia Jó 1:1";
        let found = matcher.find_books(text);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].book_name, "Jó");
        assert_eq!(&text[found[0].start..found[0].end], "Jó");
    }
}
