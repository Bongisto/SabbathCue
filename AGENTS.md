# Agent instructions

## Skills

Reusable skills for this repo live in `.agents/skills/<name>/SKILL.md`. Load a skill by
reading its SKILL.md (and the reference files it links) before starting the matching task:

- **debugging** — `.agents/skills/debugging/SKILL.md`. MANDATORY whenever you investigate
  a bug, error, crash, wrong output, hang, or flaky test, or when a fix attempt has
  already failed once. Do not change code to "see if it helps" — follow the skill's
  reproduce-first, root-cause-only protocol and keep its evidence log.
- **codebase-understanding** — `.agents/skills/codebase-understanding/SKILL.md`. Use when
  starting work in an unmapped/unfamiliar area, before designing any non-trivial change,
  and after any change that alters architecture, flows, schema, interfaces, or config.
  Maintains the living map at `docs/CODEBASE.md` — read it before changing code, update
  it in the same commit as structural changes.
- **deep-research** — `.agents/skills/deep-research/SKILL.md`. MANDATORY whenever you
  research, look up, verify, compare, or scrape/extract information from the web, docs,
  or files. Never present a claim without an opened source; keep the claims ledger and
  deliver findings in the dossier format the skill defines.
- **rust-best-practices** — `.agents/skills/rust-best-practices/SKILL.md`. Use when
  writing, reviewing, or refactoring Rust code (src-tauri).
- **vercel-react-best-practices** — `.agents/skills/vercel-react-best-practices/SKILL.md`.
  Use when writing or reviewing React/frontend code.

## Paddle

- **Agent skills** (checkout, webhooks, sync, etc.) live under `.agents/skills/paddle-*`.
- **Paddle MCP** (`paddle-sandbox` / `paddle-live`) is optional and configured in Cursor
  MCP Tools — see `.cursor/mcp.json.example` and
  [Paddle MCP server](https://developer.paddle.com/sdks/ai/paddle-mcp.md). When MCP tools
  are available, prefer them for catalog setup and webhook configuration (`paddle-catalog-setup`).
  Sandbox keys only work against `https://sandbox-mcp.paddle.com/mcp`.
