# Source Quality — Hierarchy and Verification Checks

Use this to grade every source in the claims ledger and to decide where to look first.
The rule of thumb: **the closer a source is to the event, the artifact, or the data, the
more it is worth.** Distance adds distortion.

## The hierarchy — highest trust first

### Tier 1 — Primary (the thing itself)
- Source code, commit history, release tags, changelogs
- Official specifications, standards (RFC, W3C, ISO), reference documentation
- Original papers (read the actual paper, not the abstract, not the press release)
- Raw datasets, benchmarks you can re-run, filings (SEC, patents, court records)
- First-party announcements from the maintainer/company (a claim by an interested
  party — authoritative for *what they say*, not for *whether it's good*)
- Direct statements by the person/organization in question

### Tier 2 — Expert secondary (someone qualified who examined the primary)
- Peer-reviewed analyses and reputable systematic reviews
- Postmortems and engineering blogs by the team that did the work
- Maintainer answers in issue trackers and mailing lists
- Established journalism with named sources and corrections policy
- Practitioner writeups with reproducible steps or data

### Tier 3 — Community signal (weak individually, strong in aggregate)
- Stack Overflow, GitHub issues/discussions, HN, Reddit, Discourse forums
- Individually unreliable; twenty independent users hitting the same bug is real evidence.
  Weigh volume, independence, and recency — not eloquence.

### Tier 4 — Aggregated/derived (use only as a map to better sources)
- Wikipedia (mine its citations, cite those), tutorial sites, listicles,
  "top 10 X" posts, AI-generated summaries, vendor comparison pages
- Never a terminal citation for a load-bearing claim.

### Tier 0 — Radioactive (do not cite, treat as leads at most)
- Uncited claims on content farms; pages with no author, no date, no sources
- Affiliate reviews (revenue depends on the verdict)
- Screenshots of claims (find the original), viral social posts, anonymous assertions

## Per-source verification checklist

Run this on every source before its claims enter the ledger:

- [ ] **Who wrote it?** Named author/org with relevant expertise? Anonymous = downgrade.
- [ ] **When?** Publication date AND the date of the underlying information (an article
      from today can describe a 2022 benchmark). Undated + time-sensitive = UNVERIFIED.
- [ ] **What's upstream?** Does it cite sources? Follow them — is this an origin or an
      echo? An echo inherits the origin's grade, never adds to corroboration count.
- [ ] **What's the incentive?** Selling something, ranking for ads, litigating a grudge?
      Interested-party claims need independent corroboration, not another interested party.
- [ ] **Does it show its work?** Data, methodology, reproducible steps beat assertions.
- [ ] **Is it internally consistent?** Numbers that don't add up, quotes that don't match
      linked sources — one caught fabrication poisons the whole source.
- [ ] **LLM-slop check:** generic confident prose, no specifics, hallucinated-looking
      citations, publish-date clusters across identical sites. Discard, don't debunk.

## Independence test for corroboration

Two sources corroborate each other **only if** neither derives from the other and they
don't share a common upstream. Check: do they cite the same origin? Same author or owner?
Same press release? Published within hours of each other with the same phrasing? If yes —
that is one source wearing two hats.

## Grading — the only four grades

| Grade | Meaning | Allowed use |
|---|---|---|
| VERIFIED | Traced to origin + ≥1 independent corroboration, dated | State as fact, with citations |
| SINGLE-SOURCE | One credible source, origin traced | State with explicit attribution ("according to X…") |
| DISPUTED | Credible sources conflict | Present both sides + your assessment, labeled as inference |
| UNVERIFIED | Couldn't trace, date, or corroborate | Omit, or flag loudly as unverified lead |
