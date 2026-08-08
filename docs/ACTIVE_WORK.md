---
doc_status: current
last_validated: 2026-08-08
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

## Canonical Source

- Canonical clone: `C:\Users\conno\redbyte-ui-genesis-main`
- Remote: `https://github.com/swaggyp52/redbyte-ui-genesis.git`
- Target board: Basys3 (`xc7a35tcpg236-1`)
- Pinned runtime: Node 20.19.0 / pnpm 10.24.0

## Two-Lane Source Truth

### Release lane

- `main` and `origin/main`: `57c8a94abd15d1810bf1f85eadf751c116ffbaa6`
- Release state: **Stable Preview - Browser-E0**
- This remains the released source truth. The Product System v3 candidate has
  not modified, merged into, or deployed from `main`.
- Historical RC, rescue, and checkpoint branches remain recovery evidence, not
  active product sources.

### Product System v3 candidate lane

- Branch: `product/redbyte-workbench-v3`
- Draft PR: [#80](https://github.com/swaggyp52/redbyte-ui-genesis/pull/80)
- Milestone: **Milestone B2 - Visual Workbench Reconstruction**
- Status: implemented with bounded local validation and six final visual
  captures. Draft PR #80 remains the review boundary; user visual acceptance
  remains the merge gate.
- Live impact: none. The candidate is not merged, deployed, or release-certified.

Do not describe candidate behavior as current `main` behavior. Do not merge the
candidate or begin Milestone C until this visual reconstruction is reviewed and
accepted.

## Candidate Product Truth

The candidate's student-visible workbench spine is:

```text
Project
-> Design
-> Simulate
-> Board & Constraints
-> Build & Export
```

`Import / Recover` is a separate reviewed utility, not a numbered stage. Vivado
owns synthesis, implementation, timing analysis, bitstream generation,
programming, and physical observation outside RedByte's browser workbench.

The candidate now combines the shared workbench foundation, native reusable
visual hierarchy, and the RedByte Studio reconstruction. Studio Light owns the
application surfaces while dark instrument surfaces are limited to the circuit
canvas, waveform, and code viewer. Project, Design, Simulate, Board &
Constraints, and Build & Export use full-width task compositions. This does not
broaden circuit, simulation, HDL, board, or hardware support.

## Candidate Evidence And Exit Gates

- Milestone B2 visual evidence is stored under
  `docs/release/evidence/milestone-b2/`: six exact-size final captures and five
  compact before/after comparisons. Milestone B1 hierarchy evidence remains in
  the adjacent `milestone-b1/` folder.
- The browser record covers theme persistence, project reload, command
  execution, dock visibility and geometry persistence/reset, semantic inline
  mapping, board synchronization, and root-axis overflow at the captured
  viewports. It proves only the interactions it asserts.
- Implementation-time focused tests cover the theme, project repository,
  workspace preferences, command registry/palette, shared shell, project
  projections, component facade, Basys3 profile/projection, mapping workflows,
  and visible stage grammar.
- The Milestone B2 local Node 24.15.0 closeout passed workspace typecheck, IDE
  CSS audit, unified build, `git diff --check`, and a normal browser walkthrough.
  The pinned runtime remains Node 20.19.0. A bounded six-file test selection
  exposed 39 stale Verify/Export wording and retired-work-object assertions;
  those expectations are legacy debt, not authority to restore old UI.
- The affected classroom browser gates cover root overflow, loaded-path first
  viewport ownership, active-mode reload, contextual Design support docks,
  integrated Simulate signals, obstruction, and primary-workspace utilization.
- The 12-capture evidence is generated after the final documentation commit so
  the screenshots and machine-readable record identify the exact candidate
  SHA. The full release/classroom aggregate remains outside Milestone A.
- Visual acceptance is still required before any merge. Browser screenshots
  and Playwright assertions are Browser-E0 evidence only.

## Known Candidate Debt

- `ProjectRepository` is a versioned facade over the existing browser-storage
  backing; IndexedDB migration remains a later schema-migration project.
- Durable recovery snapshots exist, and corrupt repository indexes now rebuild
  through bounded reconstruction/rollback tests. Recovery-candidate and session
  signaling still need further hardening.
- Portable project backup does not yet include every workspace-local,
  multi-scenario authoring document.
- Native visual hierarchy supports reusable HalfAdder-style modules and direct
  module navigation. Buses/named nets, code-backed modules, parameters/generics,
  and broader top-module tooling remain future depth work.
- Multiple constraint sets, broader Basys3 peripherals, and deeper compatibility
  analysis belong to later milestones.
- No Product System v3 candidate claim includes Vivado E1, bitstream E2, board
  observation E3, production readiness, or unsupervised classroom reliability.

## Next Authorized Endpoint

Deliver the Milestone B2 Studio reconstruction to draft PR #80 and stop for
visual acceptance. The next planned milestone is **Milestone C - Scenario and
Testbench Composer**. Do not begin it until the current workbench is reviewed
and explicitly accepted.

## Start

For the released Stable Preview:

```powershell
cd C:\Users\conno\redbyte-ui-genesis-main
git switch main
corepack pnpm run dev
```

For authorized Milestone A candidate work, verify the branch before editing:

```powershell
cd C:\Users\conno\redbyte-ui-genesis-main
git switch product/redbyte-workbench-v3
git status -sb
```

Open `http://localhost:5173`.

## Proof Boundary

Stable Preview - Browser-E0 and Product System v3 Browser-E0 evidence are not
production-readiness, Vivado, bitstream, hardware, classroom-certification, or
maintenance-free claims. The verified pre-consolidation archive remains under
`C:\Users\conno\RedByteArchive\2026-07-27\`.
