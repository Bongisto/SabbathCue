import { extractSpokenNumberPhrase } from "@/lib/spoken-number"

/**
 * Single source of truth for recognising spoken hymn/song commands.
 * Lives outside `services/hymnal/hymn-voice-control` so the transcription
 * event bridge can gate on it without lazily loading the hymnal data chunk.
 */

const HYMN_CUE_WORD_PATTERN =
  "(?:hymn|hymns|hymnal|hymnals|song|songs|lied|liedere|liedboek|liedboeke)"
const HYMN_COLLECTION_PATTERN =
  "(?:sda|adventist|adventiste|seventh(?:\\s|-)?day\\s+adventist|sewende(?:\\s|-)?dag\\s+adventiste)"
// STT providers render the spoken abbreviation for "number" as "no"/"nr"
// ("Hymn No. 46") far more often than the full word.
const HYMN_NUMBER_CONNECTOR_PATTERN = "(?:number|nommer|no|nr)"

const HYMN_COMMAND_PATTERN = new RegExp(
  `\\b(?:${HYMN_COLLECTION_PATTERN}\\s+${HYMN_CUE_WORD_PATTERN}|${HYMN_CUE_WORD_PATTERN})(?:\\s+${HYMN_NUMBER_CONNECTOR_PATTERN})?\\s+([a-z0-9][a-z0-9\\s-]*)`,
  "i"
)

export function normalizeHymnCueText(text: string): string {
  return text
    .toLowerCase()
    // Fold diacritics before stripping so Afrikaans compound numbers written
    // with a diaeresis ("tweeëntwintig") stay one token instead of splitting
    // at the ë.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Captured tail after a hymn cue word, or null when no cue is present. */
export function matchHymnCue(text: string): string | null {
  const normalized = normalizeHymnCueText(text)
  if (!normalized) return null
  return normalized.match(HYMN_COMMAND_PATTERN)?.[1] ?? null
}

/**
 * Cheap pre-filter for `transcript_final` events: true when the utterance
 * could be a hymn command and the hymn voice-control module should be
 * loaded. Runs the same normalization + cue pattern as `parseHymnCommand`;
 * only the hymnal-range check (which needs the heavy hymnal index) is left
 * to the full parse.
 */
export function looksLikeHymnCommand(text: string): boolean {
  const phrase = matchHymnCue(text)
  return phrase !== null && extractSpokenNumberPhrase(phrase) !== ""
}
