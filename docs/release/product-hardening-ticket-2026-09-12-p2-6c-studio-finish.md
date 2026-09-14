# P2.6C - Studio finish and session reliability

- Date: 2026-09-12
- Owner: Connor Angiel
- Surface: Project, Design, Simulate, Board, Board Check, Package
- Journey: create, author, run, investigate, repair, map, package, save and reopen
- Mode: Browser E0; portable project format 1
- Environment: Windows; isolated Chromium profiles; Node 20.19.0; pnpm 10.24.0
- Fresh machine: not tested. Clean browser profiles: yes.
- GitHub: existing draft PR #86, existing feature branch and base

## Problem and reproduction

At baseline 0de624738 (implementation 0f941296e), open the two-bit counter,
run its checks, change EN at t2, rerun and inspect the retained failure.
The recording equation and wrapped selection/failure controls consume several
rows before the trace. At 200% text the experiment begins below the viewport.
Project identity has the same small typography as metadata. Inactive Board
legends are dim. Split circuit labels are small. Two 512-case recordings use
about five million stored characters; ordinary iteration risks save failure.
The classroom chain and Design/Verify consumers also retain unresolved failures.

Expected: a clear primary work object, direct ordinary actions, subordinate
details, readable board states, durable complete sessions and meaningful gates.
Severity: high for save loss/failure; medium for composition and test debt.

## Evidence and authorities

Before captures: `.redbyte/e2e-evidence/studio-matched/p2-6c-before-0de624738/`.
Current source, active V1 contract, Product Manual, Gap Audit, IDE system map,
SURFACE_CONFORMANCE and manual-assignment QA govern this pass. The P2.6B report
and `docs/validation/test-debt.md` are the prior measured evidence, not new results.

## Acceptance

- Matched browser inspection at laptop, large, constrained, 200% text and zoom.
- Single Run, optional checks, retained configuration reproduction, immutable
  historical failure, exact recorded values and exact package bytes preserved.
- Ten complete 512-case recordings across three configurations; reopen early
  and recent records, reproduce an older configuration, preserve package behavior.
- Non-destructive legacy migration, malformed import, interrupted/concurrent
  write and controlled failure recovery; Saved only after durable completion.
- Focused storage/surface tests, typecheck, all 15 built journeys, canonical
  classroom/repository chains, protected goldens, build, CSS/docs/encoding checks.
- Feature-branch push, draft PR and exact preview verified. No production or
  hardware-tier claims. Remaining failures retain command, evidence and impact.

## Documentation and disposition

Review/update current surface specs, persistence documentation, validation debt,
AI_STATE and ACTIVE_WORK with measured outcomes. Detailed proof stays in the
established ignored `p2-6c` evidence directory. Status: validated feature candidate with explicit remaining debt.

Application candidate 6206d3fbb passes all 72 classroom stages with the final
fresh-profile test fixture, and all 15 built journeys.
Storage workload and failure recovery pass. Repository-status remains red and
raw typecheck has 570 existing diagnostics. Enlarged-text/zoom composition and
owner visual/extended-session acceptance remain open. ACTIVE_WORK and the local
p2-6c final report contain the delivery/evidence boundaries.
