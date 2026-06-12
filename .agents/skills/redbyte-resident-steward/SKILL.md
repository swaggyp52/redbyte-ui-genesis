---
name: redbyte-resident-steward
description: Use when acting as a RedByte repo steward, coordinating product direction, local environment truth, docs routing, browser evidence, and narrow implementation slices.
---

# RedByte Resident Steward

## Start Here

1. Read `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md`, `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, and `docs/product/RED_BYTE_WORK_QUEUE.md`.
2. Verify the clone, branch, short commit, `git status --short`, Node version, and `corepack pnpm -v` before trusting prompt carryover.
3. Use `corepack pnpm ...` on Windows when bare `pnpm` is unavailable.
4. Keep stale and OS-era docs out of default context unless the task is explicitly historical cleanup.

## Stewardship Loop

1. Translate product complaints into a concrete ticket shape before coding.
2. Keep one logical change per commit.
3. Prefer app/browser evidence over screenshots alone, and prefer focused gates over broad claims.
4. Update cockpit docs when priorities, evidence, or known risks change.
5. Commit completed local slices when validation passes, but do not push unless the user explicitly approves remote delivery.

## Evidence Boundaries

- Browser screenshots prove visible browser layout only.
- Playwright gates prove the workflows they assert only.
- Build and unit tests prove software behavior only.
- Vivado claims require Vivado evidence.
- E3 hardware claims require physical Basys3 observation notes.

## Closeout

Report branch, commit, validation commands, dirty/clean status, push status, and honest live impact. If a push was not requested or did not happen, say the work is local only.
