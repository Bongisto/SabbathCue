# Codebase Map Template

Copy this structure to `docs/CODEBASE.md` when creating the map; keep the section order
when updating. Every factual claim carries a receipt — a `file:line` reference or a
command with its real output. Unverifiable items go to §13 Open Questions, never inline
as fact. Delete guidance blockquotes once filled.

Legend used throughout: 🔴 high risk · 🟡 watch · 🟢 healthy · **STALE(date)** = section
known to be outdated, do not trust until refreshed.

---

```markdown
# Codebase Map — [project]
Created: [YYYY-MM-DD] · Last verified: [YYYY-MM-DD] · Confidence: Low/Medium/High

## 0 · Snapshot
| Field | Value |
|---|---|
| Purpose (one line) | |
| Primary language(s) / framework(s) | |
| Repo shape | monolith / monorepo / services / library |
| Entry points (count) | |
| Persistence | |
| Deploy target | |

**One-paragraph summary** (write last): what this system does, who uses it, and the
single most important thing to know before changing it.

## 1 · Purpose & context
> Problem solved, users/consumers, in scope vs out of scope. Receipt: README §, docs, or
> the code that proves it.

## 2 · Tech stack
| Layer | Technology | Version | Receipt |
|---|---|---|---|
| Language | | | manifest file:line |
| Framework | | | |
| Database | | | |
| Cache / queue | | | |
| Build / tooling | | | |
| Testing | | | |
| Infra / deploy | | | |

## 3 · Architecture overview
> The shape and the major components. A mermaid diagram beats prose:

​```mermaid
flowchart LR
    Client --> API[API layer] --> Service[Business logic] --> DB[(Database)]
    Service --> Ext[External services]
​```

**Style & key patterns:** [ layering, DI, event-driven, ... ]
**Where the pattern is violated:** [ the exceptions — these matter most ]

## 4 · Directory structure
| Path | Responsibility (verified by looking inside) | Notes |
|---|---|---|
| `/src/...` | | |

## 5 · Entry points & core modules
| Entry point | Location | What it starts |
|---|---|---|
| | file:line | |

**Core modules** — the 5–10 files/packages that matter most (by centrality, churn, or
size — see toolkit):
| Module | Location | Responsibility | Depended on by |
|---|---|---|---|

## 6 · Traced flows
> One subsection per core flow, traced end-to-end with file:line at every hop.

### Flow: [most important user action]
​```
[entry]  src/routes/x.ts:42
  → [validation]  src/middleware/y.ts:10
  → [logic]       src/services/z.ts:88   (state: reads cache, writes DB)
  → [response]
async boundaries: [...]   errors handled at: [...]   errors swallowed at: [...]
​```

## 7 · Data model & persistence
| Entity | Storage | Key fields | Relationships | Defined at |
|---|---|---|---|---|

**Migrations / schema management:** [ tool, directory, how to run — receipt ]

## 8 · Interfaces & integrations
**Public interfaces:**
| Interface | Type (REST/CLI/event/export) | Description | Auth | Defined at |
|---|---|---|---|---|

**External services:**
| Service | Purpose | Criticality | Called from |
|---|---|---|---|
| | | 🔴/🟡/🟢 | file:line |

## 9 · Configuration & environments
| Variable / setting | Purpose | Required | Default | Read at |
|---|---|---|---|---|

Environments: [ dev / staging / prod — how they differ ]

## 10 · Build, run & test — commands that actually ran
​```bash
# install     [exact command + result]
# run locally [exact command + result]
# test        [exact command + result, coverage if measured]
​```
CI/CD & deployment: [ pipeline files, what triggers what ]

## 11 · Quality, risks & tech debt
| Observation | Area | Severity | Receipt |
|---|---|---|---|
| | security/perf/maintainability/testing | 🔴/🟡/🟢 | |

**Strengths:** ·
**Top risks (ranked):** 1. · 2. · 3.

## 12 · Onboarding notes
> The 3–5 things you wish someone had told you on day one. Highest value per line in
> the whole document.

## 13 · Open questions
> Everything unverified or surprising. A checked-off question moves its answer (with
> receipt) into the right section above.
- [ ]

## 14 · Glossary
| Term | Meaning |
|---|---|

## 15 · Map changelog
> One line per update: date · what changed in the codebase · which sections were updated.
| Date | Change | Sections touched |
|---|---|---|
```

---

## Maintenance rules

1. **Same-commit rule:** a change that alters anything in §§3–10 updates those sections
   in the same commit, plus a §15 changelog line.
2. **STALE beats wrong:** can't update a section right now? Mark its heading
   `**STALE(YYYY-MM-DD)**` so no one trusts it silently.
3. **Verify on read:** whenever you use the map and find a claim that no longer matches
   the code, fix it (or mark STALE) immediately — even if it's not your section.
4. **Refresh `Last verified`** in the header only after actually re-checking the
   sections you relied on, not on every edit.
