# Diagnostic Toolkit

Tactics for steps 3–6 of the protocol. Consult when generating hypotheses, choosing an
observation method, bisecting, or fighting a flaky bug.

## The scientific loop

```
1. REPRODUCE   make it fail on demand
2. OBSERVE     read the full error + capture state
3. HYPOTHESIZE ranked list, each with a prediction
4. TEST        one variable, observe, record ──┐ eliminated → next hypothesis
   └───────────────────────────────────────────┘
5. confirmed → ROOT CAUSE → TEST (red) → FIX (green) → VERIFY
```

## Differential debugging — "what changed?"

Most bugs correlate with a change. Before deep-diving, compare working vs broken:

- **Code** — `git log`, recent merges, the introducing commit (`git bisect`).
- **Dependencies** — version bumps, lockfile changes, transitive updates.
- **Config / environment** — env vars, feature flags, infra, secrets, runtime version.
- **Data** — a new record shape, an empty result, a null, an unexpected scale.
- **Inputs** — what is different about the failing input vs one that works?

## Bisection

```bash
# Regression — find the commit that introduced it:
git bisect start
git bisect bad                 # current commit is broken
git bisect good <known-good>   # a commit where it worked
# run the repro at each step; mark good/bad; git lands on the culprit
git bisect reset
```

No VCS signal? Bisect the code path: short-circuit or comment out half the suspect path,
run the repro, keep the half where the failure persists, halve again. Also works on
**input**: shrink the failing input until removing one more piece makes it pass — that
piece is the trigger.

## Choosing an observation method

| Situation | Best tool |
|---|---|
| Intermittent, production, async, timing | Targeted logging — capture state across runs |
| Deterministic, complex local state | Debugger / breakpoints, step through |
| Noisy surroundings | Extract the failing unit into an isolated scratch test |
| Large failing input | Binary search on the input |

Log the *specific values your hypotheses will need*, not generic "got here" lines.

## Bug-class checklist (hypothesis generator — scan when stuck)

- [ ] Null / undefined / None — unhandled empty or missing value
- [ ] Off-by-one — boundary, fence-post, `<` vs `<=`, length vs index
- [ ] Type coercion / casting — string vs number, truthiness, implicit conversion
- [ ] Async / race / ordering — missing await, unhandled promise, callback order
- [ ] State mutation — shared/aliased object mutated unexpectedly
- [ ] Stale cache / memoization — old value served after a change
- [ ] Boundary conditions — empty list, single element, max size, zero, negative
- [ ] Encoding / locale / timezone — UTF-8, date parsing, DST, float precision
- [ ] Resource issues — leak, exhaustion, unclosed handle, connection pool
- [ ] Error swallowing — exception caught and ignored upstream
- [ ] Config / environment drift — works locally, fails elsewhere
- [ ] Third-party change — API contract, dependency behaviour, schema
- [ ] Concurrency — deadlock, lost update, non-atomic read-modify-write
- [ ] Assumption violation — an invariant the code assumed but never enforced

## Flaky / intermittent (Heisenbug) protocol

1. Make it *more* reproducible before fixing. Find the nondeterminism source: time,
   randomness, ordering, concurrency, external state, test pollution.
2. Run the repro in a loop; record the hit rate and the conditions correlated with failure.
3. Pin the variable: seed the randomness, freeze the clock, force the ordering, isolate
   shared state. A flake you can make deterministic is a normal bug.
4. Fix the cause of the nondeterminism, not the symptom. Verify across many runs
   (50–100), not one lucky green.

## Valid proof vs. not proof

Valid:
- Raw reproduction output — full error and stack trace, verbatim.
- Pasted observed state — the actual value, not a description of it.
- Experiment result — the command run and its real output.
- `git diff` of the fix — exact lines.
- Red→green test pair; full-suite summary line.

Not proof (each of these means: go run it and paste it):
- "I found the bug." · "This should fix it." · "The cache was stale."
- Summarizing output instead of pasting it.
- Stating how a dependency/API behaves without citing docs or a reproduction.
