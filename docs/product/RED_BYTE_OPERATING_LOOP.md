---
doc_status: current
last_validated: 2026-05-10
owner: Connor Angiel
used_by_claude: true
role: RedByte session closeout operating loop contract
---

# RedByte Operating Loop

RedByte Operating Loop v0.6 connects three layers into one disciplined handoff:

1. RedByte repo and product work
2. Marcus Pi product-operations node
3. Codex/Copilot implementation slices

The closeout command is:

```bash
pnpm rb:session:close
```

## What the loop is

RedByte repo work -> session closeout -> Marcus sync -> next-work handoff.

Session closeout generates a local packet and report every time, then performs Marcus sync only when safe and available.

## What the loop is not

- Not an autonomous coding agent.
- Not a replacement for Codex or Copilot implementation work.
- Not a replacement for canonical repo docs.
- Not a proof source by itself.
- Not a reason to treat E2 board programming as E3 observed behavior.

## Command surface

```bash
pnpm rb:session:status
pnpm rb:session:close
pnpm rb:session:test
```

### rb:session:status

Structured status output includes:

- current branch
- latest commit
- dirty and untracked summary
- Marcus reachability via /ping
- token presence flag only (never prints token)
- packet generation readiness
- current next-work source when available

### rb:session:close

Closeout behavior:

1. Gather repo branch, commit, and status.
2. Generate a bounded repo summary packet through Marcus sync module logic.
3. Write local closeout artifacts:
   - `.redbyte/session/latest-closeout.json`
   - `.redbyte/session/latest-closeout.md`
4. Check Marcus /ping.
5. If token is missing, skip sync with explicit degraded note.
6. If token exists and Marcus is reachable, post repo summary and verify /product-state and /next-work.
7. Print a concise closeout result for the next agent.

Degraded behavior is explicit and non-fatal:

- missing token -> `Marcus sync skipped: missing token.`
- unreachable Marcus -> `Marcus sync skipped/failed: unreachable.`

### rb:session:test

Runs local deterministic tests for:

- closeout report schema shape
- dirty git representation
- token detection without token leakage
- missing-token degraded mode
- unreachable-Marcus degraded mode
- closeout report path confinement under `.redbyte/session`
- command allowlist constraints

No network or token is required for local tests.

## Closeout report contract

Closeout JSON uses schema:

- `redbyte-session-closeout-v1`

Key sections:

- `repo`: branch, commit, dirty state, status list
- `marcus`: base URL, reachability, token-present flag, sync attempt/result, verification checks
- `packet`: generation status, size, summary, generation error
- `next_work` and `blocked_work`: source-backed handoff context
- `warnings`: do-not-touch reminders

## Safety boundaries

The operating loop must not:

- print `MARCUS_TOKEN`
- require Marcus online for local closeout success
- fail whole closeout only because Marcus is offline
- clone the repo onto Marcus
- execute arbitrary shell commands
- modify product UI
- touch unrelated `.agents/` or `.codex/` files

## Session ritual

Run this at the end of each bounded implementation slice:

```bash
pnpm rb:session:close
```

Resulting behavior:

- what changed is captured in a deterministic closeout report
- evidence posture remains explicit
- blockers and do-not-touch boundaries are preserved
- Marcus state is updated when available
- the next Codex/Copilot agent has a clear handoff source
