# Product Hardening Ticket — Verify observe vs compare vs Run clarity (Phase 5)

## Ticket

- **Title:** Verify — primary Run must reflect observe vs compare intent
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Verify (`VerifyCommandBar`, `buildVerifySessionViewModel`, draft placeholder)
- **Journey segment:** First Verify landing, run with checks, trace-only path, stale/failure re-run
- **Linked docs:** `docs/release/product-hardening-ticket-template.md`, `AGENTS.md`

## Runtime scenarios

| Scenario | Friction (pre-fix) |
|----------|---------------------|
| First-time Verify before run | **Run** and **Use saved checks** could disagree: toggle armed compare but button still said **Run current stimulus** (same as observe). |
| Run with checks available | Student switches to **Use saved checks** — primary Run gave **no** explicit compare cue. |
| Compare / saved-checks path | After a verify run, **Update run** did not say whether next run was observe or compare. |
| Failure / incomplete | Same ambiguous **Update run** when deciding whether to re-observe or re-compare. |
| Trace vs expected inspection | Observe-first label did not reinforce “this run only captures outputs”; compare label now states **compare checks**. |

## Narrow blocker register

| Sev | Title | Evidence | Root cause | Fix |
|-----|-------|----------|------------|-----|
| **SEV-2** | **Primary Run label ignored observe vs compare** | `buildVerifySessionViewModel.runLabel` used **Run current stimulus** / **Update run** for **both** `simulation` and `assertion` modes | `runLabel` branched on stale/lastRun only, not `mode` | Encode intent: **Run · observe only**, **Run · compare checks**, and matching **Update run · …** strings |
| SEV-3 | Draft waveform placeholder forced generic Run text | `VerifySurface` `emptyStateRunLabel` used literal **Run current stimulus** whenever `isDraftSession` | Hardcoded override masked view-model | Use **`verifySession.runLabel`** always for placeholder |

## Chosen blocker

**SEV-2** (plus draft placeholder override) — single highest-friction **control** issue: the **main Run button** did not say what the next run would do.

## Disposition

- **Status:** fixed in slice
- **Commit:** `3d06eb1433fe5ad244cfe3cb7ad9a59a17a63586`

## Attribution

Connor Angiel
