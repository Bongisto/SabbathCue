# Evidence Log Template

Copy this whole file to `DEBUG_LOG.md` at the start of every debugging session and fill it
in **as you go, append-only**. Do not edit entries after pasting — this is the record of
what actually happened, not a story written afterward. Paste raw output verbatim;
descriptions of output are not evidence.

---

## Bug definition (step 1)

```
BUG / TICKET:       [ id or short slug ]
SYMPTOM (exact):    [ paste the real error/wrong output, verbatim ]
EXPECTED:           [ what should happen ]
ACTUAL:             [ what happens instead ]
DELTA:              [ the specific difference that defines the bug ]
REPRO STATUS:       [ ALWAYS / INTERMITTENT ~X in N / ENV-SPECIFIC (where) / NOT YET ]
ENVIRONMENT:        [ OS, runtime, versions, config, data conditions ]
FIRST OBSERVED:     [ when / version / after which deploy ]
LAST KNOWN GOOD:    [ version/commit where it worked — enables bisection ]
RECENT CHANGES:     [ deploys, dependency bumps, config/data changes around onset ]
IN SCOPE (may modify):  [ files/areas, or "TBD until root cause found" ]
OUT OF SCOPE:           [ files/areas that must not be touched ]
DEFINITION OF FIXED:    [ verifiable criteria — repro passes, regression test exists,
                          suite green, no symptom-masking ]
```

## B.1 · Reproduction (step 2)

```
STEPS / SCRIPT:
[ exact steps or repro code ]

FAILURE OUTPUT (verbatim, full stack trace):
[ paste ]

RELIABILITY: [ deterministic N/N | intermittent X/N + conditions ]
```

## B.2 · Evidence captured (step 3)

```
FULL STACK TRACE: [ paste — mark the relevant frame ]
OBSERVED STATE AT FAILURE: [ actual bad value | where first seen | expected value ]
DIFFERENTIAL (failing vs working case): [ what differs ]
```

## B.3 · Hypothesis log (step 4)

```
H1: [ suspected cause ]
    Predicts: [ what I'll observe if true ]
    Test:     [ the experiment — one variable ]
    Result:   [ CONFIRMED / ELIMINATED ]
H2: ...
```

## B.4 · Isolation / bisection log (step 5)

```
EXPERIMENT 1 — [ the one variable changed ]
  OBSERVED: [ raw output ]
  VERDICT:  [ confirms/eliminates which hypothesis ]
  PROBE REVERTED: [ yes / n-a ]
...
NARROWED TO: [ function / line / condition ]
BISECT (if used): [ introducing commit or failing region + output ]
```

## B.5 · Root cause (step 6)

```
ROOT CAUSE (one sentence): [ the bad value X originates at Y because Z ]
WHY CHAIN: [ symptom → ... → deepest controllable cause ]
CAUSE→SYMPTOM EVIDENCE: [ the observation proving this cause produces this failure ]
```

## B.8 · Regression test (step 7 → 8)

```
TEST CODE: [ paste ]
RED  (before fix): [ failing output — fails on the expected assertion, right reason ]
GREEN (after fix): [ passing output ]
```

## B.6 · Fix diff (step 8)

```
[ paste git diff — minimal, scoped, no leftover probes ]
```

## B.7 · Verification output (step 8)

```
ORIGINAL REPRO RE-RUN: [ output — symptom gone ]
FULL SUITE: [ output + summary line — zero new failures ]
TYPE-CHECK / LINT: [ output — no new issues ]
SIBLING GREP: [ pattern + output + verdict: none / N found & handled / logged follow-up ]
INTERMITTENT (if applicable): [ N runs, 0 failures ]
```

## B.9 · Root-cause writeup (step 9)

```
ROOT-CAUSE WRITEUP — [ bug id ] — [ date ]
1. SYMPTOM:            [ what was observed, plainly ]
2. ROOT CAUSE:         [ deepest controllable cause, one or two sentences ]
3. MECHANISM:          [ why that cause produced this symptom — the chain ]
4. HOW IT WAS FOUND:   [ the key experiment that pinned it — ref B.3/B.4/B.5 ]
5. THE FIX (why correct): [ addresses the cause, not the symptom — ref B.6 ]
6. VERIFICATION:       [ repro passes + red→green + suite green — ref B.7/B.8 ]
7. PREVENTION & FOLLOW-UPS: [ regression test added; siblings; validation/monitoring gaps ]
```

## Sign-off

```
Root cause confirmed with evidence:        YES / NO
Symptom-masking introduced:                NONE / explain
Regression test (red → green) attached:    YES / NO
Original reproduction now passes:          YES / NO
Definition of fixed verified:              YES / NO
```

Every "NO" or blank above means the bug is **not fixed** — say so plainly in your report.
