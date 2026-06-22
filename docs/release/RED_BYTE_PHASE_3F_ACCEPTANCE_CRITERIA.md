---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Phase 3F acceptance criteria
---

# RedByte Phase 3F Acceptance Criteria

Phase 3F is a proof-readiness slice for Product Trust Reset v2 PR #78. It is not another Verify feature slice and it does not claim Vivado build, Basys3 programming, or physical observation proof.

## Scope

Phase 3F must prove that the current Verify V2 authority and local project persistence can survive realistic browser classroom use well enough to make the remaining risks explicit.

Required proof areas:

- Verify accessibility and keyboard operability.
- Verify zoom/contrast durability at classroom viewport size.
- Project snapshot/runtime/session durability across reload.
- Corrupt browser storage recovery without fatal UI or stale trusted PASS.
- Multi-tab overwrite warning instead of silent conflict.
- Help / Diagnostics support bundle with project, mode, Verify, storage, browser, and build metadata inside the diagnostics boundary.
- A 30-profile browser classroom rehearsal script with tracked limits.

## Acceptance Gates

These commands are the Phase 3F focused proof anchors:

- `pnpm -s ide:gate:verify-accessibility-v2`
- `pnpm -s ide:gate:verify-keyboard-grid-v2`
- `pnpm -s ide:gate:verify-zoom-contrast-v2`
- `pnpm -s ide:gate:project-durability-v2`
- `pnpm -s ide:gate:verify-corrupt-state-recovery-v2`
- `pnpm -s ide:gate:verify-multitab-conflict-v2`
- `pnpm -s ide:gate:diagnostics-bundle-v2`
- `pnpm -s rehearsal:classroom-30`
- `pnpm -s rehearsal:classroom-verify`
- `pnpm -s rehearsal:classroom-recovery`

The focused gates are wired into `classroom:gate` and `verify:gates:classroom`. The 30-profile rehearsals remain explicit release/rehearsal scripts because they are heavier endurance proof, not a small per-surface smoke.

## Current Evidence

Phase 3F local browser evidence currently includes:

- `.redbyte/rehearsal/phase-3f/classroom-full-30.json` and `.md`: `30/30` passed for starter load, rename, Verify PASS, reload restore, and corrupt-storage recovery.
- `.redbyte/rehearsal/phase-3f/classroom-verify-30.json` and `.md`: `30/30` passed for Verify PASS and reload restore endurance.
- `.redbyte/rehearsal/phase-3f/classroom-recovery-30.json` and `.md`: `30/30` passed for reload restore and corrupt-storage recovery.

The generated timestamps are UTC. This evidence is browser E0 only and must not be summarized as Vivado or Basys3 proof.

## Pass Criteria

Phase 3F is acceptable when:

- Verify controls used in the normal Course checks -> My checks -> Compare loop have accessible names.
- Course expected-output cells are disabled and explain the Duplicate to My checks path.
- A keyboard-only user can duplicate Course checks, edit an expected-output cell, stale the current result, and run Compare.
- Core Verify controls remain visible and measurable at 125 percent visual zoom.
- Core Verify text/control contrast stays at or above the Phase 3F 3:1 browser-gate floor.
- Saved project snapshot, saved-project index, and runtime state exist after a normal loaded-project save and reload.
- A malformed runtime/session localStorage state does not crash the app and does not restore a trusted PASS.
- A second tab writing the runtime project key produces a visible Reload/Dismiss conflict banner in the first tab.
- Diagnostics exposes the full build fingerprint and support bundle only behind Help / Diagnostics, while normal student chrome still hides raw build hashes and E-tier language.
- The 30-profile scripts write JSON and Markdown evidence under `.redbyte/rehearsal/phase-3f/`.

## Explicit Non-Claims

Phase 3F does not:

- Change simulation semantics.
- Change Compare semantics.
- Change pin mapping semantics.
- Change VHDL, XDC, testbench, Tcl, ZIP generation bytes, or goldens.
- Change `.rbproj` project format.
- Add SaaS/accounts/cloud sync.
- Claim Vivado 2024.2 build proof.
- Claim Basys3 programming or physical observation proof.
- Complete the target journaled storage facade, rolling snapshots, or quota-risk UX.

## Remaining Release Blockers

- Storage writes are still localStorage writes, not journaled commits.
- Rolling snapshots remain future work.
- Storage quota failure is still not surfaced as a first-class user action.
- The multi-tab boundary is a visible warning, not full conflict resolution.
- Classroom confidence still requires human rehearsal and, for hardware claims, real Vivado/Basys3 evidence.

## Attribution

Connor Angiel
