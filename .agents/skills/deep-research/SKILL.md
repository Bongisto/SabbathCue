---
name: deep-research
description: >
  Verification-first deep research and information-gathering protocol. Use this skill whenever:
  (1) researching any topic, technology, library, market, person, or claim,
  (2) scraping or extracting information from the web, docs, or files,
  (3) the answer is not on the first page of results — hidden, obscure, or hard-to-find information,
  (4) asked to "find out", "look into", "compare", "verify", or "compile" anything,
  (5) making a recommendation that depends on facts you did not verify this session.
  Never present a claim without a source you actually opened; never stop at the first
  plausible answer; always deliver findings in the durable dossier format.
metadata:
  author: rhema
  version: "1.0.0"
allowed-tools: Read Grep Glob Bash PowerShell WebFetch WebSearch Write Edit
---

# Deep Research Protocol

Twenty years of research taught me one thing above all others: **the first plausible
answer is a trap.** It is what everyone else found, it is what the SEO farms optimized
for, and it is wrong just often enough to ruin you. Real research is the discipline of
distrusting what is easy to find until you have verified it against what is hard to find.

You are less experienced than the people these rules were written for. Follow them
literally.

**The whole method in one line:**
> Define the question → map the source landscape → collect wide → verify every load-bearing claim against independent primary sources → dig past the surface for what's hidden → compile into a dossier that stays useful after you're gone.

## Banned words and banned moves

In findings, these are forbidden unless immediately followed by a citation:
**"studies show", "it is known", "experts say", "generally", "it seems", "reportedly"**.
Every factual sentence in your output must be traceable to a source you personally opened
this session — not one you remember, not one another article mentioned.

Forbidden moves:

- **Search-snippet citing** — citing a page from its search-result snippet without opening it.
- **Single-source certainty** — presenting a claim as fact with one source. One source is
  an allegation; two independent sources are a finding.
- **Citation laundering** — treating ten articles that all cite the same original as ten
  sources. Trace every chain to its origin; count origins, not echoes.
- **Recency blindness** — presenting information without checking its date. A 2021 answer
  about a fast-moving topic is often worse than no answer.
- **Answer-shaped stopping** — stopping because the result *looks* complete rather than
  because the verification checklist *is* complete.
- **Inventing** — filling a gap with something plausible. A documented gap ("could not
  verify X; here is what I tried") is a deliverable. A fabrication is sabotage.

## The claims ledger — create it first

Before searching, create a scratch file `RESEARCH_LOG.md` from
[references/dossier-template.md](references/dossier-template.md) (Part A). Every claim you
intend to use goes in as a row: the claim, the source URL, source type (primary/secondary/
tertiary), date of the information, how it was corroborated, and a confidence grade. If a
claim is not in the ledger with a source, it does not go in the final output. Ever.

## The six phases — in order

### 1 · Define the question before touching a search box
Write down: the exact question(s), what a *sufficient* answer looks like, what decisions
the answer will drive, the freshness requirement (does last year still count?), and the
known unknowns. A research task without a definition of done becomes infinite browsing.
If the question is ambiguous, ask the user now — not after three hours of collecting.

### 2 · Map the source landscape
Before consuming content, spend five minutes asking: *who would actually know this, and
where do they write it down?* Primary sources first — official docs, source code, specs,
filings, datasets, the original paper, the person themselves. The full source-quality
hierarchy and per-source verification checks are in
[references/source-quality.md](references/source-quality.md). Plan to hit at least two
independent branches of that hierarchy for every load-bearing claim.

### 3 · Collect wide, record everything
Run multiple *differently-phrased* searches, not one search read deeply — vary
terminology, take the opposing view's vocabulary, search in the domain's jargon.
Open the sources; extract with page/section anchors; log each into the ledger **as you
read it**, not from memory afterward. When scraping files or sites, capture provenance
with every extract: URL/path, retrieval date, and the exact locator (heading, line,
timestamp) so any claim can be re-checked later.

### 4 · Verify — the part everyone skips
For every claim that your conclusion depends on:
1. **Trace it upstream** to the original source. Cite the origin, not the echo.
2. **Corroborate independently** — a second source that does not derive from the first.
3. **Date it** — when was this true, and is it still?
4. **Check the incentive** — who benefits from you believing this? Vendor benchmarks,
   press releases, and affiliate reviews are claims by interested parties, not findings.
5. **Hunt the disconfirming source** — actively search for evidence you are wrong
   ("X criticism", "X vs", "X problems", "why not X"). If you only searched in favor of
   your conclusion, you did marketing, not research.
Grade every ledger row: **VERIFIED** (2+ independent sources, traced to origin) /
**SINGLE-SOURCE** / **DISPUTED** (sources conflict — report the conflict, don't pick a
side silently) / **UNVERIFIED**. Only VERIFIED claims may be stated as fact.

### 5 · Dig — where the hidden information lives
The surface web's first page is where research starts, not ends. When the easy sources
run dry, work through [references/deep-tactics.md](references/deep-tactics.md):
search operators, archives and deleted content, primary-document repositories, code and
issue trackers, forums where practitioners complain, and pivoting on names, identifiers,
and exact phrases. Budget rule: if two more search variations produce nothing new, change
*tactic* (a different source class), not just *wording*. Log dead ends in the ledger —
"looked here, found nothing" is information that saves the next researcher hours.
Stay inside the law and the user's authorization: no bypassing access controls, no
scraping behind logins you weren't given, respect the site's terms when the user hasn't
directed otherwise.

### 6 · Compile — the dossier
Raw notes rot; a dossier stays useful. Write the final output using Part B of
[references/dossier-template.md](references/dossier-template.md): direct answer first,
then findings *ranked by confidence* with inline citations, then disputed points, then
gaps and how you tried to fill them, then the full source list with dates. Separate the
three voices explicitly and never blend them:
- **FACT** — verified, cited.
- **INFERENCE** — your reasoning over facts, labeled as yours.
- **SPECULATION** — flagged loudly or omitted.
Date-stamp the dossier and state its shelf life ("prices checked 2026-07; recheck before
relying on them"). A reader six months from now must be able to tell instantly which
parts to trust and which to refresh.

## When the trail goes cold

After 3 tactic changes with no new information: stop digging and report honestly — what
was found, what wasn't, everywhere you looked, and your best-supported partial answer with
its confidence grade. "I could not verify this, and here is the search trail" is a
professional deliverable. Padding thin findings to look complete is the one sin this
protocol exists to prevent.

## Hard stops

| # | Rule |
|---|---|
| HS-1 | No claim in the output without a source opened this session and logged in the ledger. |
| HS-2 | No load-bearing claim stated as fact on a single source or an uncorroborated chain of echoes. |
| HS-3 | Never cite a page you did not open, or a quote you did not see verbatim. |
| HS-4 | Undated information on a time-sensitive question is UNVERIFIED until dated. |
| HS-5 | Conflicting sources are reported as a conflict, never silently resolved. |
| HS-6 | Gaps are documented, never filled with plausible invention. |
| HS-7 | Disconfirming-evidence search is mandatory before any recommendation. |
| HS-8 | No access-control bypass, no unauthorized scraping, no impersonation to obtain information. |
| HS-9 | Final output uses the dossier structure with the FACT/INFERENCE/SPECULATION separation. |
| HS-10 | Every extract carries provenance (source, locator, retrieval date) sufficient to re-verify it. |

**The litmus test before any dossier ships:** pick your three most important claims at
random — can you show, for each, the original source, an independent corroboration, and
the date it was true? If not, the research is not done; the writing just is.
