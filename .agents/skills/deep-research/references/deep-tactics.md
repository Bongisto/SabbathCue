# Deep-Digging Tactics — Finding What the First Page Hides

Work these when surface search runs dry. The rule: when a tactic stops yielding, switch
**source class**, not just query wording. Log every dead end — "not there" is a finding.

Boundaries: everything here is open-source intelligence on public information. No
bypassing access controls or paywalls, no scraping behind logins you weren't given, no
impersonation. If the missing piece requires crossing that line, report the gap instead.

## 1 · Query engineering

- **Exact-phrase pivots:** put distinctive strings in quotes — error messages, function
  names, part numbers, a memorable sentence from a document. Unique strings cut through
  SEO noise instantly.
- **Operators:** `site:` (confine to a domain: `site:github.com`, `site:*.gov`),
  `filetype:pdf|xls|csv|pptx` (reports and internal docs live in files, not pages),
  `-term` (exclude the noise), `intitle:`, `inurl:`, `before:/after:` date bounds.
- **Vocabulary shifting:** search the practitioner's jargon, the academic's terminology,
  the critic's framing, and the layman's phrasing — each surfaces a different stratum.
  Search in other languages when the subject has a non-English home.
- **Negative-space searches:** "X problems", "X vs", "migrating away from X",
  "X postmortem", "X CVE" — the complaints are where the truth about X lives.

## 2 · Archives and the deleted web

- **Wayback Machine** (`web.archive.org`): removed pages, edited claims, old pricing,
  original wording before the walk-back. Compare snapshots over time to see what changed —
  *what someone deletes tells you what they don't want known.*
- Search-engine cache, archive.today for recent deletions.
- Old versions of docs/READMEs via git history: `git log -p -- <file>`, GitHub's blame
  and history views; deleted repos often survive in forks.

## 3 · Code, issues, and the engineering record

Software truths are in the repo, not the marketing page:
- **GitHub code search** for exact strings/identifiers across all public code — find real
  usage, workarounds, and config nobody documents.
- **Issue trackers and PR discussions:** known limitations, maintainer intent, the "won't
  fix" list. Sort by most-commented; read the closed-as-wontfix ones.
- **Changelogs, release notes, migration guides, deprecation notices** — what a project
  admits about itself.
- **Commit messages and blame** — the *why* behind a line, and when behaviour changed.
- Mailing lists (lore.kernel.org, Google Groups), RFC discussion threads, design docs.

## 4 · Primary-document repositories

- Academic: Google Scholar, arXiv, PubMed, Semantic Scholar — then **follow citations
  both ways**: what does this paper cite (origins) and who cites it (corrections,
  refutations, replications)?
- Legal/regulatory: court records, SEC/EDGAR filings, patent databases, FOIA reading
  rooms, government statistical agencies. Filings are made under penalty — they out-rank
  press releases about the same facts.
- Standards bodies, conference talks (the Q&A at the end often says what the slides
  won't), theses (deep detail nobody else publishes).

## 5 · Where practitioners actually talk

- Domain-specific forums, Discords/Slacks with public archives, subreddit deep search
  (old.reddit + search operators), HN Algolia search (`hn.algolia.com`) for years of
  practitioner commentary on nearly any technical topic.
- Ask: *who is forced to deal with this daily, and where do they complain?*

## 6 · Pivot searching (connecting the dots)

When you have one fragment, pivot on it:
- A name → their papers, talks, repos, filings, employment history.
- A company → its filings, job postings (the tech stack in job ads is ground truth),
  trademark/domain registrations, executive interviews.
- A unique identifier (DOI, CVE, ticket number, product SKU, email domain) → every
  document that shares it.
- An image or document → reverse-image search; check file metadata you already have
  legitimate access to (PDF author fields, EXIF) for names, tools, and dates.

## 7 · Scraping and extraction discipline

When pulling data from pages or files at scale:
- Prefer the structured back door: official APIs, RSS/Atom, sitemaps, `.json`/`.csv`
  endpoints the site's own frontend calls — cleaner and more polite than parsing HTML.
- Fetch politely: identify sensibly, rate-limit, cache what you fetched (re-fetching is
  rude and slow), respect robots.txt absent explicit user direction otherwise.
- **Provenance on every extract:** source URL/path, retrieval timestamp, exact locator
  (CSS selector, heading, page number, line). An extract you can't re-verify is a rumor.
- Validate immediately after extraction: row counts, spot-check 5 random records against
  the live source, check encoding and truncation *now* — not after analysis is built on it.

## 8 · Knowing you've hit bottom

Stop digging when either: (a) new sources only repeat origins already in the ledger
(saturation), or (b) three consecutive tactic switches yield nothing new. Then write up
what you have — including the map of where you looked. The search trail of a failed hunt
is the map the next hunt starts from.
