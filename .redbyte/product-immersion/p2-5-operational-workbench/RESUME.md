# RedByte P2.5 — Operational Classroom Workbench Convergence — RESUME

> Single continuation point for P2.5. Newest entry at the top of the ledger.
> Canonical repo docs still win. `docs/ACTIVE_WORK.md` = project truth ·
> this file = session continuation · the P2.5 PR = public review truth.

## Canonical state

> The live branch HEAD is whatever `git rev-parse HEAD` / the PR reports — this
> file does NOT hardcode a self-referential "current HEAD" that goes stale the
> moment the next commit lands. The fields below name durable anchors only.

- **CONTINUATION BRANCH:** `claude/redbyte-operational-workbench-convergence-w9k2r4`
  (created from the corrected P2 head; PR #84 remains the immutable P2 review).
- **CURRENT PR:** #85 — P2.5 draft, open, mergeable, **targeting
  `claude/redbyte-product-core-convergence-n3pi6t`** (temporarily stacked on PR
  #84; retarget to `product/redbyte-workbench-v3` only AFTER #84 merges — never
  before, and never by this session).
- **BRANCH POINT:** `f8899a462` — the P2 truth-correction commit = PR #84 head =
  PR #85 base SHA.
- **LAST VERIFIED PRODUCT COMMIT:** `1c5c4745e` (Slice 3 compare-verdict fix).
  GitHub reports **six** commits on the branch point (not five):
  `8a5cbef74` Slice 0 baseline + imported-VCD demotion → `359adc098` Slice 1
  shell status authority → `49abc102f` Slice 2 Project landing → `02dc9e147`
  labday harness/stale-testid repair → `1c5c4745e` Slice 3 Compare verdict →
  the first documentation-refresh commit (docs only).
- **CURRENT PHASE:** first checkpoint delivered — Slices 0–3 + labday baseline-red
  repair (13→4). The real UI-driven Journey A, Board (Slice 4), and Export are the
  next work.
- **CURRENT ACCEPTANCE PROOF (honest, narrow):** `compare-verdict-journey.mjs`
  proves ONLY the Compare verdict transition — a run presents PASS, a deliberately
  changed design presents FAIL, and undo + rerun returns to PASS — at 1440×900 and
  1366×768, 0px overflow. It does NOT prove failure diagnosis, mismatch rows,
  source/Design tracing, scenario preservation, mapping, trusted export, download,
  or reload. It also currently drives the runtime store directly (`loadExample`,
  `autoSuggestMapping`, store gate-lookup, force-click), which the P2.5 acceptance
  contract forbids. Replacing it with a genuine student-driven journey is required.
- **BLOCKERS:** none on the branch itself. Format v2 stays gated behind
  `FORMAT_V2_SIGNOFF.md`; format version 1; both classroom goldens byte-identical
  (last verified 2/2 green under the pinned runtime). PR #84 not merged; do not
  merge or retarget.
- **LAST VALIDATION (pinned runtime, cloud session):** shell-status-authority,
  project-landing, compare-verdict journeys PASS at both viewports (0px overflow);
  verify suites 30→26 failed (+4, 0 regressions); labday 13→4; both classroom
  golden export gates byte-identical. CI: PR Fast Checks run #81 SUCCESS at the
  checkpoint head (`b952d46b`); PR #84 head `f8899a462` also green.
- **RUNTIME CAVEAT:** this branch was built and validated in a Linux cloud session
  under the repo pin (Node 20.19.0, chromium at `/opt/pw-browsers/chromium`). The
  desktop clone currently runs **Node 24.15.0** with no pinned Node installed;
  golden SHAs are known to drift under Node 24, so golden-gate re-verification is
  NOT faithful from the desktop until Node 20.19.0 is available.
- **NEXT REQUIRED JOURNEY:** a UI-only Full Adder acceptance journey (zero store
  actions) — Project → Start a Lab → Design → author a check → Compare PASS →
  runnable wrong-logic edit → FAIL with a concrete mismatch → Trace in Design →
  repair → PASS → Board mapping → trusted export → download → reload.
- **DIRTY FILES:** none.

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
- **Slice 2 — Project landing:** DONE (`49abc102f`, browser-proven both
  viewports). Leads with one dominant "Start a Lab" over a subordinate
  alternatives cluster; the giant hero and narration line are gone. Open
  remainder: the empty region below RECENT and the loaded-overview consolidation.
- **Remaining:** Slice 3 follow-on (real failure diagnosis — mismatch rows vs
  structural failure; a UI-only Journey A), 4 (Board consolidation + Export
  readiness + FPGA-part authority), 5 (import review E2E, hand-authored source
  persistence, parameters, Vivado twin ingestion), 6 (five Gannon labs), 7
  (baseline-red disposition + state audit). Journeys A–E.

## Ledger (newest first)

- **Local ThinkStation session — run intent, FPGA-part, UI-only Journey A core.**
  Environment corrected to the repo pin (portable Node 20.19.0 at
  `.redbyte/tools/node-v20.19.0-win-x64`; all local validation runs under it).
  - `3d65bf423` `fix(sim)`: render the Observe/Compare run-intent selector (was
    dead props) and make it authoritative; a structurally-blocked Compare stays
    selected + disabled ("Compare blocked") with the Design-repair path, never a
    silent Observe. 8 command-bar + 1 structural-block test fixed; 0 regressions;
    **CI green under Node 20.19.0**.
  - `583fef846` `fix(target)`: FPGA part is board-owned read-only (Basys3 →
    xc7a35tcpg236-1); removed the freeform edit the export always ignored; labday
    test moved to the board-owned contract.
  - `04b980b90` `test(e2e)`: `full-adder-operational-journey.mjs` — **UI-only**
    Journey A core (zero store actions): first use → Start a Lab → Lab 3 Full
    Adder → Design → Compare PASS → inspector gate-swap XOR→OR → Compare FAIL with
    a concrete mismatch → Trace in Design → repair → PASS, both viewports,
    cross-platform, 0px overflow, 0 errors.
  - **Next:** author-a-check step; extend the journey through Board mapping →
    trusted export → download → reload; then the Board & Export convergence
    (Sections 6 & 8 — a deliberate design pass, not to be rushed).
- **Slice 3 follow-on — failure-diagnosis authority fix + investigation (`b5453b2a2`).**
  Live browser investigation corrected the D-5 framing: the runnable wrong-logic
  path already shows a full, visible failure diagnosis (advanced-failure panel +
  first-mismatch fail-nav + drawer mismatch table + trace-to-Design); gate deletion
  is STRUCTURAL (output floats to X) and is intercepted upstream by the compiler's
  `blockingDesignIssue` (Compare blocked). Landed a pure-authority fix so
  `diagnoseVerifyFailure` treats an observed `X`/`-` failing output as
  `disconnected-output` (Design repair), not a fixable expected-value mismatch (+3
  tests, zero regressions). Two real browser-provable defects recorded for the next
  slice (see DECISION_LEDGER D-6): the "Design blocks Compare" structural callout does
  not reliably render after a gate delete, and the Observe/Compare intent toggle is
  not rendered (dead `VerifyCommandBar` props) — the latter blocks the UI-only Journey
  A. Node 24.15.0 desktop; goldens untouched.
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
