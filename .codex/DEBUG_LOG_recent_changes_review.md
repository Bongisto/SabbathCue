# Evidence Log - Recent Changes Review - 2026-07-13

## Bug definition

```
BUG / TICKET:       EGW cleanup review failure after recent paragraph-splitting changes.
SYMPTOM (exact):    Focused data tests fail when run with plain Vite config:
                    1) merged page-number split emits continued_pages: [] and page: undefined
                    2) cross-page continuation does not include continued page 10
EXPECTED:           No empty continued_pages property; cross-page merged paragraph records the second printed page.
ACTUAL:             Tests fail with received continued_pages: [] and with [] not containing 10.
DELTA:              Merge bookkeeping does not distinguish absent continuation pages from an empty array and does not add the next paragraph's page when merging across pages.
REPRO STATUS:       YES
ENVIRONMENT:        Windows PowerShell, local checkout C:\Users\fanel\Downloads\rhema-main\rhema-main, branch fix/egw-paragraph-splitting.
DEFINITION OF FIXED: Focused data tests pass with the same command; no new broad check failures.
```

## Reproduction

```
COMMAND:
npx.cmd vitest run --config vite.config.ts data/lib/egw-text-cleanup.test.ts data/lib/egw-pdf-importer.test.ts

RESULT:
data/lib/egw-text-cleanup.test.ts: 2 failed, 6 passed
data/lib/egw-pdf-importer.test.ts: passed

FAILURES:
- merges a paragraph split by PDF page numbers: expected object without continued_pages/page, received continued_pages: [] and page: undefined.
- merges a continuation that spans a printed page and records the span: expected continued_pages to contain 10, received [].
```

## Hypothesis

```
H1: The merge path always assigns an array for continued_pages and only copies existing continued_pages arrays, but it never records paragraph.page when previous.page !== paragraph.page.
Prediction: data/lib/egw-text-cleanup.ts has duplicated merge assignment that spreads continued_pages arrays without adding the merged paragraph's own page.
Result: Confirmed by reading cleanEgwParagraphs merge path and mergeReadableContinuations merge path.
```

## Root cause

```
The bad continued_pages value originates in the merge bookkeeping because merging constructs a new array from existing continued_pages only. When neither side has existing spans it writes [], and when the next paragraph is on a new page it omits that page unless it was already present in next.continued_pages.
```

## Fix

```
Added mergedContinuedPages(previous, next) in data/lib/egw-text-cleanup.ts.
The helper preserves existing spans, adds next.page when previous.page and next.page differ, de-duplicates page ids, and returns undefined for an empty span list.
Both merge paths now call the helper.
```

## Verification

```
COMMAND:
npx.cmd vitest run --config vite.config.ts data/lib/egw-text-cleanup.test.ts data/lib/egw-pdf-importer.test.ts

RESULT:
2 files passed, 12 tests passed.
```
