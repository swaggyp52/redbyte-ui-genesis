---
doc_status: current
last_validated: 2026-08-01
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
- Milestone: **Milestone A - Cohesive Workbench Foundation**
- Status: implemented and bounded local validation is complete. Exact-HEAD
  Browser-E0 evidence and draft-branch delivery identify the candidate; user
  visual acceptance remains the merge gate.
- Live impact: none. The candidate is not merged, deployed, or release-certified.

Do not describe candidate behavior as current `main` behavior. Do not begin
Milestone B without separate authorization after the Milestone A acceptance
decision.

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

Milestone A adds the light-first visual system, shared shell, command registry
and palette, persistent workspace preferences, Project Center, configurable
Design docks and toolbar, component-definition facade, and one synchronized
Basys3 board-profile/mapping projection. It does not broaden circuit,
simulation, HDL, board, or hardware support.

## Candidate Evidence And Exit Gates

- Local Browser-E0 evidence is stored under
  `.redbyte/product-immersion/workbench-v3-milestone-a/`. The delivery sequence
  regenerates the 12 required viewport captures plus the machine-readable
  browser evidence record from the final candidate commit; older ignored
  captures are not exact-candidate authority.
- The browser record covers theme persistence, project reload, command
  execution, dock visibility and geometry persistence/reset, semantic inline
  mapping, board synchronization, and root-axis overflow at the captured
  viewports. It proves only the interactions it asserts.
- Implementation-time focused tests cover the theme, project repository,
  workspace preferences, command registry/palette, shared shell, project
  projections, component facade, Basys3 profile/projection, mapping workflows,
  and visible stage grammar.
- The bounded Node 20.19.0 closeout passed: 40 changed/new focused test files
  with 287/287 tests, workspace typecheck, IDE CSS audit, and the unified build
  with 344 transformed modules plus a verified distributable. Canonical-doc,
  encoding, and whitespace checks are part of the same closeout record.
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
- Hierarchy and source views expose current project truth but remain
  inspect-oriented; nested module editing, buses/named nets, code-backed modules,
  parameters/generics, and top-module selection belong to Milestone B.
- Multiple constraint sets, broader Basys3 peripherals, and deeper compatibility
  analysis belong to later milestones.
- No Product System v3 candidate claim includes Vivado E1, bitstream E2, board
  observation E3, production readiness, or unsupervised classroom reliability.

## Next Authorized Endpoint

Deliver the validated Milestone A candidate, its exact-HEAD Browser-E0 evidence,
and the coherent commits to draft PR #80. Stop at the draft candidate and await
the user visual-acceptance/merge decision. The next planned milestone is
**Milestone B - Hierarchical Design and Component Depth**, but it is not started
and requires separate authorization.

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
