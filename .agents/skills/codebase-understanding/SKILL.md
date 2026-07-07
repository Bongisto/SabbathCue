---
name: codebase-understanding
description: >
  Systematic protocol for building and maintaining a verified map of a codebase. Use this skill whenever:
  (1) starting work in a repo (or area of a repo) you have not mapped this session,
  (2) onboarding to a new/unfamiliar codebase, or asked to "explain", "document", or "audit" one,
  (3) planning any non-trivial change — the map is read BEFORE designing the change,
  (4) after completing a change that alters architecture, data flow, interfaces, or config —
  the map must be updated so it stays true.
  The output is a living document, docs/CODEBASE.md, that makes every future change,
  bug hunt, and review faster and better informed.
metadata:
  author: rhema
  version: "1.0.0"
  lineage: Codebase Understanding Plan & Report Template
allowed-tools: Read Grep Glob Bash PowerShell Write Edit
---

# Codebase Understanding Protocol

The most expensive mistakes I saw in twenty years were not bad code — they were correct
changes made to a system the author didn't understand. The fix that broke an invariant
nobody told them about. The feature bolted onto the wrong layer. The bug "fixed" in a
copy of the real logic. Understanding is not a nice-to-have before changing code; it *is*
the work, and the change is the last 20%.

This skill produces and maintains one artifact: **`docs/CODEBASE.md`** — a verified map
of the system. Not prose for its own sake: every claim in it carries a `file:line` or
command-output receipt, so the next agent can trust it instead of re-deriving it.

**The whole method in one line:**
> Orient without reading code → map the structure → trace the core flows end-to-end → map the data → assess how it's built, tested, and shipped → write it down with receipts → keep it true after every change.

## Rules of evidence

- **Docs are hypotheses; code is truth.** READMEs, comments, and old design docs tell you
  what someone *intended*. Verify each claim against the code before it enters the map,
  and mark anything unverified as an open question — never present it as fact.
- **Every claim gets a receipt:** a `path/file.ts:123` reference, a command plus its real
  output, or a trace you actually followed. "The auth lives in middleware" without a path
  is folklore, not a map.
- **Trace, don't infer.** Directory names lie (`utils/` holding the core algorithm,
  `legacy/` serving production traffic). You know a flow only after following it
  entry-point to response with the actual files open.
- **Say "unknown" out loud.** An open-questions list is part of the map. A blank or a
  guess in its place is how the next agent inherits your confusion as fact.
- **Never let the map rot.** A wrong map is worse than no map — agents will trust it over
  the code. If your change moves anything the map describes, updating the map is part of
  the change, not a follow-up.

## The six phases

Budget: small repo ~half a day of focused reading; large repo, map the area you're
touching deeply and the rest at one level of detail. Depth follows risk: the code you're
about to change gets traced; the code three layers away gets one line.

### 1 · Orient — before reading any code
Read `README`, `CONTRIBUTING`, `docs/`, and the manifest files (`package.json`,
`Cargo.toml`, `go.mod`, ...) to learn the stated purpose, users, and stack. Skim the
top-level tree and **write down your architecture hypothesis** — the rest of the
investigation exists to confirm or kill it, and the difference between hypothesis and
verified fact must stay visible. Check the repo's pulse: recent commits, release cadence,
open issues (the issue tracker is a map of where the code hurts).

### 2 · Map the structure
One line per top-level directory: what it holds, verified by looking inside — not by its
name. Find every **entry point** (main, server bootstrap, CLI root, workers, cron,
message consumers — there are usually more than one). Identify the layering pattern and,
crucially, **where it's violated** — the violations are where bugs live. Locate config
(`.env*`, `config/`, feature flags) and build/CI files (`Dockerfile`, `Makefile`,
pipelines). Use the commands in
[references/exploration-toolkit.md](references/exploration-toolkit.md) — the biggest
files, the most-churned files, and the most-imported modules are the real center of
gravity, whatever the README says.

### 3 · Trace the core flows
Pick the 1–3 most important user actions and follow each **end-to-end with the files
open**: entry point → routing → business logic → data layer → response, recording every
file:line hop. Note where state lives at each step (DB, cache, queue, memory, external
service), what's synchronous vs async, and where errors are caught — or swallowed.
Tracing tactics (finding the handler from a URL, following an event, walking a call
chain backward) are in the toolkit. This phase is the heart of the skill; a map without
traced flows is a directory listing.

### 4 · Map the data and the boundaries
The data model outlives every refactor — whoever understands it understands the system.
Map: entities/schema/migrations, every persistence layer, all public interfaces
(REST/GraphQL/gRPC endpoints, CLI commands, events published and consumed, exported
APIs), and every external service with its criticality. List required config/env vars
and what breaks without them. Boundaries are where systems fail; know every one.

### 5 · Assess how it's built, tested, and shipped
Actually run it: build, test suite, local startup — record the **exact commands that
worked** (and the ones that didn't, with why). Note test coverage honestly, CI/CD shape,
deployment path, environments. Skim recent history (`git log`, changelog) for direction
of travel, and note the top risks you saw: security smells, performance cliffs, tech
debt, the file everyone is afraid of.

### 6 · Synthesize into the living map
Write `docs/CODEBASE.md` using
[references/map-template.md](references/map-template.md): snapshot and one-paragraph
summary, architecture diagram, directory table, entry points and the 5–10 core modules,
traced flows, data model, interfaces, config, build/run/test commands, risks, onboarding
notes, **open questions**, and a glossary of domain jargon. Date-stamp it and every later
update. Rank content by usefulness-per-line: the five things a newcomer must know beat
fifty things they could look up.

## Using the map (this is the point)

- **Before any change:** read the map's relevant sections first; if the area you're
  touching isn't mapped or the map is stale, run phases 2–4 on that area before designing
  the change. Know which invariants and consumers your change can break *before* you
  write it.
- **When debugging:** the map's traced flows tell you where to set the first breakpoint,
  and its "state lives here" notes tell you where corruption can hide. (Pairs with the
  `debugging` skill — the map feeds its hypothesis phase.)
- **After any structural change:** update the affected map sections in the same
  commit — entry points, flows, schema, interfaces, config. Add a line to the map's
  changelog. If a change makes a map section wrong and you can't update it now, mark that
  section STALE with a date rather than leaving it silently wrong.

## When understanding runs out

If after tracing you still can't explain a component's role in one sentence, don't paper
over it: log it in Open Questions with what you tried, and — if a change depends on it —
say so to the user rather than proceeding on a guess. "I don't know yet what
`core/reconciler.ts` guarantees, and my change touches it" is senior-engineer output.

## Hard stops

| # | Rule |
|---|---|
| HS-1 | No claim enters the map without a receipt (file:line, command output, or followed trace). |
| HS-2 | Documentation and comments are never treated as verified fact — code is the arbiter. |
| HS-3 | A flow is "understood" only if traced end-to-end with the actual files, not inferred from names. |
| HS-4 | Build/run/test instructions in the map must be commands that were actually executed. |
| HS-5 | Unknowns go in Open Questions — never guessed, never blanked. |
| HS-6 | A structural change and its map update ship together; a section that can't be updated now is marked STALE, dated. |
| HS-7 | No non-trivial change is designed without reading (or first creating) the map of the affected area. |

**The litmus test:** could a competent stranger, given only `docs/CODEBASE.md`, make a
safe one-file change on day one — find the right file, know what depends on it, run the
tests, and know how it ships? If not, the map isn't done; it's just long.
