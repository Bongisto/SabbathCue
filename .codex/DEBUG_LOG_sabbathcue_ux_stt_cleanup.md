# Evidence Log - SabbathCue UX + STT Cleanup - 2026-07-12

## Bug definition (step 1)

```
BUG / TICKET:       WI-5 quick-search ghost text mismatch; broader plan includes WI-1..WI-4 cleanup/features.
SYMPTOM (exact):    Plan reports overlay renders whenever suggestion !== input with no prefix check, so normalized suggestions draw a misaligned grey string.
EXPECTED:           Ghost suffix renders only when suggestion starts with the current non-empty input, case-insensitively.
ACTUAL:             Reproduced in both current ghost-rendering surfaces before the fix.
DELTA:              Need current-code reproduction and regression test before fixing WI-5.
REPRO STATUS:       YES
ENVIRONMENT:        Windows PowerShell, local checkout C:\Users\fanel\Downloads\rhema-main\rhema-main.
FIRST OBSERVED:     Plan dated 2026-07-12.
LAST KNOWN GOOD:    Unknown.
RECENT CHANGES:     Unknown.
IN SCOPE (may modify):  Files listed in docs/plans/2026-07-12-sabbathcue-ux-stt-cleanup-plan.md section 1.2.
OUT OF SCOPE:           Files excluded by the plan section 1.3.
DEFINITION OF FIXED:    Repro/test fails before fix and passes after; targeted and broad checks show no new failures.
```

## B.1 - Reproduction (step 2)

```
STEPS / SCRIPT:
1. Inspect current ghost rendering in src/components/panels/preview-quick-search.tsx and src/components/panels/search/QuickVerseSearch.tsx.
2. Add focused regression coverage for normalized mismatch input "1 j" with suggestion "I John 1:1".
3. Run:
   npx.cmd vitest run src/lib/quick-search.test.ts -t getGhostSuggestionSuffix

FAILURE OUTPUT (verbatim, full stack trace):
TypeError: getGhostSuggestionSuffix is not a function

RELIABILITY: Deterministic in focused test run.
```

## B.2 - Evidence captured (step 3)

```
Both renderers computed ghost text from suggestion.slice(input.length) and gated only on suggestion !== input. Neither checked that the suggestion starts with the current input before rendering the grey suffix.
```

## B.3 - Hypothesis log (step 4)

```
H1: Ghost rendering components compare suggestion and input for inequality but do not require a prefix match.
    Predicts: Source code renders the overlay for mismatched normalized suggestions.
    Test:     Inspect preview-quick-search.tsx and QuickVerseSearch.tsx, then add a regression test for mismatch.
    Result:   Confirmed. Both components used suggestion !== input and suggestion.slice(input.length).
```

## B.4 - Isolation / bisection log (step 5)

```
No bisection needed: the defect was isolated to duplicated ghost suffix rendering logic in the two quick-search components.
```

## B.5 - Root cause (step 6)

```
The quick-search ghost suffix rule was duplicated in two UI components and treated any non-identical suggestion as renderable. Normalized Bible suggestions can differ in canonical spelling from the typed input, so slicing by input length produced an unrelated suffix.
```

## B.8 - Regression test (step 7 -> 8)

```
Added helper-level tests for getGhostSuggestionSuffix and component-level tests for both PreviewQuickSearch and QuickVerseSearch. The helper test was red before implementation with "getGhostSuggestionSuffix is not a function"; the full focused suite is green after implementation.
```

## B.6 - Fix diff (step 8)

```
Added getGhostSuggestionSuffix(input, suggestion) in src/lib/quick-search.ts. Both quick-search components now render ghost text only when that helper returns a suffix, and both expose data-testid="quick-search-ghost" for regression coverage.
```

## B.7 - Verification output (step 8)

```
npx.cmd vitest run src/lib/quick-search.test.ts src/components/panels/search/QuickVerseSearch.test.tsx src/components/panels/preview-quick-search.test.tsx

Result: 3 files passed, 46 tests passed.
```

## B.9 - Root-cause writeup (step 9)

```
Root cause: duplicated UI logic rendered a suffix for any changed suggestion instead of a case-insensitive prefix match. Fix: centralize the prefix-only suffix calculation and use it in both surfaces. Regression: helper and component tests cover prefix matches, normalized mismatches, and cleared input.
```

## Sign-off

```
Root cause confirmed with evidence:        YES
Symptom-masking introduced:                NONE
Regression test (red -> green) attached:   YES
Original reproduction now passes:          YES
Definition of fixed verified:              YES
```
