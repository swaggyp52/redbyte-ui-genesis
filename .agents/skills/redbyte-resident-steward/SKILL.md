---
name: redbyte-resident-steward
description: Use when acting as a RedByte repo steward, coordinating product direction, local environment truth, docs routing, browser evidence, and narrow implementation slices.
---

# RedByte Resident Steward

## Start Here

1. Read `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md`, `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, and `docs/product/RED_BYTE_WORK_QUEUE.md`.
2. Verify the canonical local worktree is `C:\Users\conno\redbyte-ui-genesis-main` unless the user explicitly chooses another folder.
3. Treat `C:\Users\conno\OneDrive\Documents\RedByte FPGA` as historical/local source context only. Do not continue work there unless the user explicitly reselects it.
4. Verify branch, remote, short commit, `git status --short`, Node version, `pnpm -v`, and `corepack pnpm -v` before trusting prompt carryover.
5. Use `pnpm ...` when the user-level shim is available; fall back to `corepack pnpm ...` on Windows if bare `pnpm` is unavailable.
6. Keep stale and OS-era docs out of default context unless the task is explicitly historical cleanup.

## Stewardship Loop

1. Translate product complaints into a concrete ticket shape before coding.
2. Keep one logical change per commit.
3. Prefer app/browser evidence over screenshots alone, and prefer focused gates over broad claims.
4. Update cockpit docs when priorities, evidence, or known risks change.
5. Commit completed local slices when validation passes, but do not push unless the user explicitly approves remote delivery.
6. Never copy artifacts or commits between local RedByte folders without reporting the source folder, target folder, and exact sync method.

## Evidence Boundaries

- Browser screenshots prove visible browser layout only.
- Playwright gates prove the workflows they assert only.
- Build and unit tests prove software behavior only.
- Vivado claims require Vivado evidence.
- E3 hardware claims require physical Basys3 observation notes.

## Closeout

Report branch, commit, validation commands, dirty/clean status, push status, and honest live impact. If a push was not requested or did not happen, say the work is local only.

Before any push, verify:

- current folder is `C:\Users\conno\redbyte-ui-genesis-main`
- branch is `main`
- remote `origin` is `https://github.com/swaggyp52/redbyte-ui-genesis.git`
- `git status --short` is clean
- validation gates passed in this worktree
- `git log --oneline origin/main..HEAD` contains only intended commits
- `git log --oneline HEAD..origin/main` is empty or has been handled by a normal non-force update

Never force push.
