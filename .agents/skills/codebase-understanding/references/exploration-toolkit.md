# Exploration Toolkit — Commands and Tracing Tactics

Tactics for phases 2–5. Prefer the harness's dedicated tools (Glob, Grep, Read) where
they exist; the shell commands below are for what those can't do. On Windows, run the
git/npm/cargo commands as-is; use PowerShell equivalents where noted.

## Finding the center of gravity

The real core of a codebase is where size, churn, and imports concentrate — not what the
README highlights.

```bash
# Size / language breakdown
tokei .          # or: cloc .

# Biggest source files (often the core logic — or the mess)
git ls-files '*.ts' '*.rs' | xargs wc -l | sort -n | tail -20

# Most-churned files (change hotspots = bug hotspots)
git log --format= --name-only -- . | sort | uniq -c | sort -rn | head -20

# Most recently active areas + top contributors
git log --oneline -20
git shortlog -sn | head

# Who to ask about a file
git log --format='%an' -- path/to/file | sort | uniq -c | sort -rn
```

Most-imported modules: Grep for the module's name/path across the repo and count hits —
high fan-in means high blast radius for any change to it.

## Finding entry points

- Manifests declare them: `package.json` (`main`, `bin`, `scripts`), `Cargo.toml`
  (`[[bin]]`), `pyproject.toml` (`[project.scripts]`), `Dockerfile` (`CMD`/`ENTRYPOINT`),
  CI/procfiles.
- Grep for the idioms: `fn main`, `if __name__`, `createServer|listen(`, `addEventListener`,
  `#[tauri::command]`, router registrations, queue/cron consumer registrations.
- Don't stop at one: web server, CLI, background workers, scheduled jobs, and message
  consumers are all entry points, and the forgotten ones cause the surprises.

## Tracing tactics

**From a URL/action to its handler:** grep for the literal route string; if routes are
built dynamically, grep for the route-registration helper and read the table it builds.
For UI: grep for the button's visible text → find the component → follow its handler.

**Walking forward (entry → effect):** open each file in the chain and follow the calls,
recording `file:line` per hop. At each hop note: state read/written, sync vs async
boundary, error handling. Stop abstracting at interfaces — find the *actual* concrete
implementation that runs (grep for the interface name's implementors; check the DI
container/factory wiring).

**Walking backward (effect → cause):** from a DB table or output, grep for the table
name / field name / output string to find every writer; from a function, grep its name
to find every caller. `git log -S 'symbol'` finds when a symbol was introduced and why
(read that commit's message and PR).

**Understanding a confusing file:** read its tests first — tests are executable
documentation of intent. Then `git log --follow -p -- file` for its evolution; the
commit that introduced the weird part usually explains it.

**Runtime confirmation when reading isn't enough:** add one temporary log line at the
suspected hop and run the flow once — a 30-second experiment beats an hour of
speculative reading. Remove the probe after.

## Mapping data and config

```bash
# Schema & migrations
ls migrations/ db/ prisma/ supabase/migrations/ 2>/dev/null
git log --oneline -10 -- '*migration*'

# Every env var the code actually reads (beats any .env.example)
grep -rn "process\.env\.\|std::env::var\|os\.environ\|env::var" --include='*.{ts,js,rs,py}' src/

# External calls
grep -rn "fetch(\|http\.\|axios\.\|reqwest::\|Client::new" src/ | head -30
```

Cross-check `.env.example` against actually-read vars — the difference (vars read but
undocumented, vars documented but unread) is a finding for the map.

## Assessing quality honestly

```bash
# Do the tests actually run, and how long?
<test command from the manifest>          # record real output, not the README's claim

# Skipped/disabled tests (confessions of known breakage)
grep -rn "skip\|todo\|xit(\|#\[ignore\]" --include='*test*' --include='*spec*' .

# Self-admitted debt
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ | wc -l     # count; read the worst offenders

# Dependency health
npm outdated / cargo outdated / pip list --outdated
```

## Reading order for a new repo (when overwhelmed)

1. Manifest + lockfile — what is this, what does it depend on.
2. The top-level tree — one glance, form the hypothesis.
3. The main entry point — read it fully; it names the major subsystems.
4. One core flow, traced (phase 3) — this teaches more than anything else.
5. The schema/models — the nouns of the system.
6. The tests of the module you'll change — intent, edge cases, and how to run them.

Resist reading files alphabetically or exhaustively; understanding comes from following
execution and data, not from coverage of the file listing.
