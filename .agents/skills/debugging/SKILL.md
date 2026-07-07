---
name: debugging
description: >
  Disciplined, reproduce-first, hypothesis-driven debugging protocol. Use this skill whenever:
  (1) investigating any bug, error, crash, wrong output, hang, or flaky test,
  (2) a fix attempt has already failed once (mandatory from the second attempt onward),
  (3) asked to "find out why" something misbehaves,
  (4) tempted to change code to "see if it helps".
  Do NOT write or change a line of fix code until the failure is reproduced on demand and the
  root cause is confirmed with pasted evidence.
metadata:
  author: rhema
  version: "1.0.0"
  lineage: DEBUGGING_PLAN_TEMPLATE v1.0 (Karpathy-style, root-cause-only)
allowed-tools: Read Grep Glob Bash PowerShell Edit Write
---

# Debugging Protocol

I am handing you twenty years of debugging in one page. Read it as law, not advice.
Every shortcut below is one I watched burn a week of someone's time. You are less
experienced than the engineers who wrote these rules — that is exactly why you must
follow them *more* literally, not less.

**The whole method in one line:**
> Reproduce it → observe it → hypothesize → test one variable → confirm the root cause → lock it in a failing test → minimal fix → prove it's gone.

A bug is a contradiction between what you *believe* the code does and what it *actually*
does. Your job is to find where the belief is wrong — by observation, never intuition.

## Banned words and banned moves

In any finding or status, these words are forbidden: **"probably", "should be",
"I believe", "likely", "might be"**. If you catch yourself using one, you have left
debugging and started gambling — go back to the last thing you actually observed.

These moves are forbidden, always:

- **Shotgun debugging** — changing several things hoping one works.
- **Guess-and-check** — editing code "to see if it helps" with no hypothesis and no prediction.
- **Symptom masking** — a `try/catch` that swallows the error, a blind retry, a bumped
  timeout, a special case for the one failing input, a suppressed warning. These are not fixes.
- **Weakening evidence** — deleting, skipping, or loosening a failing test or assertion.
- **Editing code you have not read in full this session.**
- **Declaring "fixed"** without re-running the exact original reproduction AND a regression
  test that failed before the fix and passes after.

## The evidence log — create it first

Before anything else, create a scratch file `DEBUG_LOG.md` (in the scratchpad directory,
or next to the bug if the user wants it kept) from
[references/evidence-log.md](references/evidence-log.md). Every command, output,
observation, and diff goes into it **verbatim, append-only** as you work. If you cannot
paste it, it did not happen. Summaries of output are not evidence; the output is.

## The nine steps — sequential, non-skippable

### 1 · Define the bug
Write down: the exact observed symptom (paste the real error, not "login is broken"),
expected vs actual vs the delta, environment, when it was first seen and the last known
good version, and which files you are allowed to touch. If expected behaviour is unclear —
**stop and ask the user**. You cannot fix "it's broken".

### 2 · Reproduce it reliably
Build the smallest deterministic reproduction: a failing test ideally, else a script or
exact command sequence. Run it enough times to state reliability as a number
("failed 5/5" or "failed 3/20 under load") — "it happens sometimes" is not a measurement.
Strip every step not required to trigger it; the minimal repro *is* the bug.
**No reproduction, no fix — ever.** If you cannot reproduce, gather evidence (logs, inputs
from where it does occur), document what you tried, and report back instead of patching blind.
Flaky bug? Follow the Heisenbug protocol in [references/toolkit.md](references/toolkit.md).

### 3 · Observe before theorizing
Read the **entire** stack trace — the cause is often three frames down, not the top line.
Capture the actual bad value, where it first appears, and the expected value. Trace the bad
data backward toward its source. Note what is *different* about the failing case vs a
passing one (most bugs correlate with a change: code, dependency, config, data, input).
Form no conclusions yet.

### 4 · Generate ranked hypotheses
From the evidence — not from vibes — list plausible causes. Scan the bug-class checklist in
[references/toolkit.md](references/toolkit.md) for candidates you'd miss (null/empty,
off-by-one, race, stale cache, coercion, encoding, config drift...). Each hypothesis must
carry a prediction: *"If this is the cause, I will observe ___ when I test ___."* A
hypothesis you cannot test is not a hypothesis. Rank by likelihood × cheapness to test;
prefer the experiment that eliminates the most hypotheses at once.

### 5 · Isolate — one variable per experiment
For each hypothesis: **predict → change exactly one thing** (a log line, a breakpoint, one
toggled input, one stubbed dependency) **→ run the repro → record the raw result → mark
CONFIRMED or ELIMINATED → revert the probe.** Never two variables. Never leave probe edits
in the tree. When "it used to work", `git bisect` with the repro is usually the fastest
experiment there is. Exit only when the failure is narrowed to a specific function, line,
or condition — shown, not asserted.

### 6 · Confirm the root cause
State it in one sentence: *the bad value X originates at Y because Z.* Then ask "why" until
you reach the deepest cause **you control** — a null pointer crash is caused by whatever
produced the null, not by the missing null check at the crash site. Prove the link: the
observation that shows this cause produces this symptom, and ideally a probe showing that
removing the cause removes the symptom. An unconfirmed cause is just a better-dressed guess.

### 7 · Lock it in a failing test (RED)
Before touching the fix, write the narrowest test asserting the *correct* behaviour, and
run it against the **unfixed** code. It must fail — with the same wrong value or error as
the real bug, not a setup error. If it passes on buggy code, it is not testing the bug.
This test proves you understand the bug now, and proves the fix later.

### 8 · Minimal fix (GREEN), then verify everything
Apply the **smallest change that removes the confirmed root cause**. No refactors, no
cleanups, no "while I'm here" — if the proper fix needs broader change, stop and confirm
scope with the user first. Then, in order:
1. The step-7 test now passes (paste the red→green pair).
2. The exact original reproduction from step 2 now passes (paste it).
3. Full test suite + type-check/lint: zero *new* failures.
4. `git diff` shows only the intended fix — no stray probes.
5. **Sibling check**: grep for the pattern you just fixed; the same bug class usually
   appears more than once. Fix in-scope siblings or log them as follow-ups.
6. If the bug was intermittent: run the repro 50–100 times and paste the tally.

### 9 · Root-cause writeup
Close with a short writeup in the log (structure in
[references/evidence-log.md](references/evidence-log.md)): symptom, root cause, mechanism,
how it was found, why the fix is correct, verification, and prevention. An undocumented
fix is an unfinished fix — the next agent will re-derive your whole investigation without it.

## When you are stuck

After **3 experiments that produce no new information, stop.** A 4th blind attempt is
banned. Instead:
1. Re-read your own experiment log — the contradiction is often already written down.
2. List your assumptions ("this function returns X", "this runs before that", "this input
   is non-null"). Pick the most load-bearing one and **verify it with a direct
   observation** — the bug usually lives inside an unverified assumption.
3. Re-read the failing code from scratch, without your mental model; re-minimize the repro.
4. Still stuck: report to the user with the minimal repro, the hypothesis log, and what has
   been *ruled out*. A precise "here is what it isn't" is a good deliverable; a blind patch
   is not.

## Hard stops — not overridable by urgency or your own reasoning

| # | Rule |
|---|---|
| HS-1 | No fix before reliable reproduction AND evidence-confirmed root cause. |
| HS-2 | One variable per experiment, always. |
| HS-3 | Never fix a symptom in place of the cause. |
| HS-4 | Never weaken, skip, or delete a test to go green. |
| HS-5 | "Fixed" requires: original repro passes + regression test red→green. |
| HS-6 | No fix ships without its regression test. |
| HS-7 | Never touch files outside the agreed scope without approval. |
| HS-8 | No 4th attempt at the same approach — change strategy or escalate. |
| HS-9 | A bug fix is the minimal change; it is never a refactor. |
| HS-10 | No closing the bug without the root-cause writeup. |

**The litmus test before any fix ships:** can you explain, in one sentence with pasted
evidence, the exact root cause and exactly why this change removes it? If not, you are
not ready to fix. Go back to the last observed fact.
