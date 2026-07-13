# Debug Log: Chapter Title Header Boundary

## Bug Definition

- Claim: `stripChapterFurniture` matches odd-page chapter running headers without a leading word boundary.
- Expected: `Source and Aim of True Education 11` is converted to `[11]` only when the chapter title starts at a word boundary.
- Actual to verify: text such as `XYZSource and Aim of True Education 11` can be treated as a header and rewritten.
- Scope: `data/lib/egw-pdf-importer.ts` and focused tests.

## Evidence

- Source inspected: `data/lib/egw-pdf-importer.ts`.
- Observed pattern: `new RegExp(`${escTitle}\\s+(\\d{1,3})\\b`, "gi")`.
- Sibling pattern on the previous replacement includes a leading `\b` before the page number/book-title header.

## Reproduction

Command:

```powershell
npx.cmd vitest run --config vite.config.ts data/lib/egw-pdf-importer.test.ts
```

Observed failure:

```text
expected 'XYZ [11]  should remain ordinary text.' to contain 'XYZSource and Aim of True Education 11'
```

Reliability: failed 1/1 before the fix.

## Root Cause

The odd-page chapter title header regex started with the escaped title itself, so the regex engine could begin matching after any preceding word character. That made `XYZSource and Aim of True Education 11` look like a valid `Source and Aim of True Education 11` running header.

## Fix

Add a leading word-character boundary guard with `(?<!\w)` before the escaped title. This blocks mid-word matches while preserving quoted chapter titles such as `"God With Us"`.

## Verification

- `npx.cmd vitest run --config vite.config.ts data/lib/egw-pdf-importer.test.ts`: passed, 6 tests.
- `npx.cmd vitest run --config vite.config.ts data/lib/egw-pdf-importer.test.ts data/lib/egw-text-cleanup.test.ts`: passed, 14 tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed with existing `importEgwPdf` complexity warning.
- `git diff --check`: passed with CRLF notices only.
- `bun run validate:egw`: exited 0 and printed EGW metrics; Bun also printed the existing Windows `EPERM` scan warning for the parent checkout path.
- `npm.cmd run test:unit`: passed, 941 passed and 1 skipped.
- `npm.cmd run build`: passed with existing Vite large-chunk warning.

## Sibling Check

- Searched for `escTitle`, `Chapter Title`, `titlePattern(`, and the new `(?<!\w)` guard under `data/lib` and `data/validate-egw-sources.ts`.
- No other direct `escTitle` running-header replacement without a leading guard was found.
