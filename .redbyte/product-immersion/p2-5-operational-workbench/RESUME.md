# RedByte P2.5 — Operational Classroom Workbench Convergence — RESUME

> Single continuation point for P2.5. Newest entry at the top of the ledger.
> Canonical repo docs still win. `docs/ACTIVE_WORK.md` = project truth ·
> this file = session continuation · the P2.5 PR = public review truth.

## Canonical state

- **CURRENT HEAD:** `1c5c4745e` (Slice 3 compare-verdict fix) — pushed through
  `359adc098` (Slice 1); Slices 2/2.5/3 commits push next.
  **Branch point:** `f8899a462` (the P2 truth-correction commit).
- **CURRENT BRANCH:** `claude/redbyte-operational-workbench-convergence-w9k2r4`
  (created from the corrected P2 head; PR #84 remains the immutable P2 review).
- **CURRENT PR:** #85, P2.5 draft, **targeting
  `claude/redbyte-product-core-convergence-n3pi6t`** (temporarily stacked on PR
  #84; retarget to `product/redbyte-workbench-v3` once #84 merges).
- **CURRENT PHASE:** first checkpoint delivered — Slice 0 (baseline) · Slice 1
  (shell status authority) · Slice 2 (Project landing hierarchy) · Slice 3
  headline (Compare verdict now visible) · labday baseline-red repair (13→4).
  Commit ledger: `359adc098` (Slice 1) → `49abc102f` (Slice 2) → `02dc9e147`
  (labday) → `1c5c4745e` (Slice 3 compare verdict).
- **CURRENT ACCEPTANCE JOURNEY:** Journey A CORE proven —
  `compare-verdict-journey.mjs` drives PASS→break→FAIL→undo→PASS through the real
  UI at both viewports. The tail (map → trusted export → inspect HDL/XDC/testbench
  → download → reload) is unblocked and is the next increment to a full Journey A.
- **BLOCKERS:** none. Format v2 stays gated behind `FORMAT_V2_SIGNOFF.md`; format
  version 1; both classroom goldens byte-identical (2/2 green). PR #84 not merged.
- **LAST VALIDATION:** shell-status-authority, project-landing, compare-verdict
  journeys PASS at 1440×900/1366×768 (0px overflow); verify suites 30→26 failed
  (+4, 0 regressions); labday 13→4; both classroom golden export gates green.
- **LAST PUSH:** `359adc098` (Slice 1). Slices 2/2.5/3 committed locally, push
  pending.
- **DIRTY FILES:** none (all committed); RESUME/BROWSER_JOURNEYS doc refresh in
  flight.

## Known redder-than-recorded baseline (pre-existing, not P2.5)

Slice 0 recorded only ~8 verify reds. Real pre-existing baseline is larger:
verify suites ~30 (now 26 after the Slice-3 fix); `ideApp.labday-wiring` was 13
(now 4 after the harness/stale-testid repair); `projectSurface.submission` 4 +
`continuity` 1. All reproduced with P2.5 changes stashed. Remaining reds are the
Slice-7 disposition backlog — product-triage the real ones, update only
demonstrably-obsolete assertions, never blanket-skip.

## Program (do not lose Connor's intent)

Convert the technically-capable P1/P2 candidate into a coherent, practical,
classroom-usable workbench. NOT P3 cloud, NOT format-v2, NOT feature-breadth.
Connor's core complaint: too many tabs/cards/pills/panels, inconsistent density,
surfaces that don't feel like one app, technically broad but not practically
useful. He likes strong conceptual visuals (circuit preview, waveform, board
diagram, source↔visual highlight), practical density, clear hierarchy. The fix is
NOT a flat/empty/generic UI and NOT more tabs — it is intentional hierarchy,
consolidation, and making the primary student task dominant on each surface.

Spine: Project → Design → Simulate → Board & Constraints → Build & Export.
Import/Recover is a utility. Vivado is external (Browser-E0).

## Slice status

- **Slice 0 — baseline + immersion:** DONE. CI verified green at `803e2dfd0`;
  P2 truth docs corrected (on the P2 branch, commit `f8899a462`); real-UI
  screenshots of all five surfaces at 1440×900 + 1366×768 captured under
  `baseline/`; the four baseline-red suites reproduced and their exact failures
  recorded (see DECISION_LEDGER). No root overflow on any surface at either
  viewport — the shell geometry holds; the problem is density/hierarchy/clutter.
- **Slice 3 (first increment) — Simulate density:** DONE. The imported-VCD
  Analyzer no longer dominates a native project: with no VCD loaded it collapses
  to a single compact "Load .vcd file" affordance (still honest: "replayed, never
  executed"), reclaiming ~180px so the native scenario timeline + Drive inputs +
  Inspector lead the first viewport. Browser-proven; before/after screenshots in
  `baseline/simulate-1440x900.png` vs `baseline/simulate-after-fix-1440x900.png`.
- **Slice 1 — shell/geometry:** DONE (status authority). The footer no longer
  duplicates the stage-nav's per-stage workflow status (Simulate/Board/Package
  pills removed); the footer is now support-context only (checks/storage/problems)
  and the stage-nav is the single per-stage authority. Browser-proven at both
  viewports (`shell-status-authority-journey.mjs`, 0px overflow); 7/7 focused
  tests green. On verification, three audit items were REJECTED (LocationBar is a
  real cross-mode nav authority; the save-label display:none is an intentional
  1366px-fit pair with the footer Storage pill; the Board chip is product
  identity, not duplication) and the two-stylesheet CSS merge was DEFERRED as a
  visual-regression-prone change needing headed review. See DECISION_LEDGER D-2.
- **Slice 2 — Project:** NEXT. Hero + 5 peer actions + duplicated status.
- **Remaining:** Slices 1–2, 3 (Design/Simulate repair loop + Journey A), 4
  (Board consolidation + Export readiness), 5 (import review E2E, hand-authored
  source persistence, parameters, Vivado twin ingestion), 6 (five Gannon labs),
  7 (baseline-red disposition + state audit). Journeys A–E.

## Ledger (newest first)

- **Slice 3 first increment — Simulate imported-VCD demotion.** `VcdAnalyzerPanel`
  gains a compact early-return for the no-waveform/no-error case (a single
  provider chip + honest note + Load button) instead of the full header + honesty
  paragraph + giant dashed empty box. Directly answers Connor's #1 visible
  clutter complaint and the directive's "Imported VCD should not dominate a
  native project before a VCD is loaded." Reuses the existing `importedWaveform`
  authority — no new store, no format change. Test + 1 journey step updated to
  assert the compact affordance.
- **Slice 0 — baseline + immersion.** See Slice status + DECISION_LEDGER +
  VISUAL_JURY.
