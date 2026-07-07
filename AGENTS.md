# Agent instructions

## Skills

Reusable skills for this repo live in `.agents/skills/<name>/SKILL.md`. Load a skill by
reading its SKILL.md (and the reference files it links) before starting the matching task:

- **debugging** — `.agents/skills/debugging/SKILL.md`. MANDATORY whenever you investigate
  a bug, error, crash, wrong output, hang, or flaky test, or when a fix attempt has
  already failed once. Do not change code to "see if it helps" — follow the skill's
  reproduce-first, root-cause-only protocol and keep its evidence log.
- **deep-research** — `.agents/skills/deep-research/SKILL.md`. MANDATORY whenever you
  research, look up, verify, compare, or scrape/extract information from the web, docs,
  or files. Never present a claim without an opened source; keep the claims ledger and
  deliver findings in the dossier format the skill defines.
- **rust-best-practices** — `.agents/skills/rust-best-practices/SKILL.md`. Use when
  writing, reviewing, or refactoring Rust code (src-tauri).
- **vercel-react-best-practices** — `.agents/skills/vercel-react-best-practices/SKILL.md`.
  Use when writing or reviewing React/frontend code.
