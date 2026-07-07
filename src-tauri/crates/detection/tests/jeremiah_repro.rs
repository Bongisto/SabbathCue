//! Regression tests for the 2026-07-07 live incident: the English filler
//! word "um" parses as the number 1 (Portuguese "um"), so a pending
//! book-only mention ("... in the book of Jeremiah") was completed by two
//! filler-led windows into a phantom full-confidence Jeremiah 1:1 detection.
//! That detection anchored reading mode on Jeremiah 1, whose scope filter
//! then suppressed the real Jeremiah 29:11 semantic candidates.

use rhema_detection::DirectDetector;

/// The exact live failure: bare book mention held as incomplete, then two
/// windows starting with "um" must NOT complete it into Book 1:1.
#[test]
fn um_filler_windows_do_not_complete_book_only_reference() {
    let mut detector = DirectDetector::new();

    let detections = detector.detect("do you remember the story in the book of jeremiah");
    assert!(
        detections.is_empty(),
        "bare book mention must not emit: {detections:?}"
    );

    let detections = detector.detect("um the plans that he has to prosper you");
    assert!(
        detections.is_empty(),
        "'um ...' window must not become a chapter continuation: {detections:?}"
    );

    let detections = detector.detect("um the plans that he has to prosper you not to harm you");
    assert!(
        detections.is_empty(),
        "second 'um ...' window must not become a verse continuation: {detections:?}"
    );
}

/// "um" between real reference words must not break genuine detection.
#[test]
fn um_filler_inside_real_reference_still_detects() {
    let mut detector = DirectDetector::new();

    let detections = detector.detect("okay um john chapter eight verse nine");
    assert_eq!(detections.len(), 1);
    assert_eq!(detections[0].verse_ref.book_name, "John");
    assert_eq!(detections[0].verse_ref.chapter, 8);
    assert_eq!(detections[0].verse_ref.verse_start, 9);

    let mut detector = DirectDetector::new();
    let detections = detector.detect("john chapter um eight verse um nine");
    assert_eq!(detections.len(), 1, "fillers inside a reference: {detections:?}");
    assert_eq!(detections[0].verse_ref.chapter, 8);
    assert_eq!(detections[0].verse_ref.verse_start, 9);
}

/// Portuguese profile must keep treating "um" as the number one.
#[test]
fn portuguese_um_still_parses_as_one() {
    let mut detector = DirectDetector::for_stt_language("pt");

    let detections = detector.detect("João 3 versiculo um");
    assert_eq!(detections.len(), 1, "pt reference: {detections:?}");
    assert_eq!(detections[0].verse_ref.book_name, "Joao");
    assert_eq!(detections[0].verse_ref.chapter, 3);
    assert_eq!(detections[0].verse_ref.verse_start, 1);
}
