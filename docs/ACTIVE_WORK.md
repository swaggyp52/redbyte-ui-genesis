---
doc_status: current
last_validated: 2026-08-28
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
- Milestone: **Integrated Studio Reconstruction**
- Status: implemented on the existing candidate branch for user visual review.
  One shell now owns identity and stage navigation; Project, Design, Simulate,
  Board & Constraints, and Build & Export use one presentation system and their
  existing semantic authorities. The scenario composer and hierarchy remain
  authoritative. This candidate is not merged, released, or hardware-proven.
- Live impact: none. The candidate is not merged, deployed, or release-certified.

Do not describe candidate behavior as current `main` behavior. Do not merge the
candidate or begin the next milestone until this composer slice is reviewed and
accepted.

### Production convergence lane (2026-08-28, cloud session)

- Branch: `claude/redbyte-production-convergence-ynz291` (based on
  `origin/product/redbyte-workbench-v3` @ `ab5c1e02`), targeting the product
  branch via draft PR.
- Delivered: modernized Cloudflare deployment
  (`cloudflare/wrangler-action@v3` + `wrangler pages deploy`; main = production,
  `product/**`/`claude/**` = SHA-verified previews; explicit SKIPPED when
  credentials absent), new `pr-fast-checks.yml` PR lane, rebuilt
  `public/start.html` doorway and `README.md` on the v3 observe-first model,
  docs vocabulary convergence (course/handoff/labs/canonical specs), one
  canonical `DEPLOYMENT.md`, boot-chunk failure fallback, storage-guarded
  stores, wrangler pinned as devDependency, dead root `index.html` removed.
- Known red at this head: `pr-truth-gates` dies in its FIRST gate
  (`ide:gate:examples-contract` races the collapsed v3 examples disclosure —
  fix in this lane); `rc:d0:project-determinism-gate` baseline hash is stale at
  `ab5c1e02` (pre-existing; excluded from the PR fast lane until the drift is
  explained; do not silently re-baseline).
- Boundary: the newer desktop-local head `65e1ff872` is NOT on origin and is
  unreachable from cloud sessions. Desktop must push
  `product/redbyte-workbench-v3` before PR #80 can advance to it; nothing in
  this lane rewrites that branch.

### Core product build lane (2026-08-29, cloud session)

- Branch: `claude/redbyte-desktop-build-m5ryqw` (base `513b003cc` = v3 +
  all of PR #81, which was strictly ahead of v3 — a pure fast-forward
  union), delivered via draft PR
  [#82](https://github.com/swaggyp52/redbyte-ui-genesis/pull/82) into the
  product branch. Merging #82 also resolves #81.
- Delivered: single-main landmark contract; Design library rail rebuilt on
  the component registry (port lines, capability chips, drag-to-place,
  collapse persistence, keyboard nav); full align/distribute; S hotkey;
  unified zoom steps + % readout; node/canvas context menus; on-canvas
  rename; fanout junction dots; marquee wire adoption; instance-aware
  breadcrumbs + per-module camera memory; Project sources view with derived
  compile order; Duplicate project; ExamplesBrowser activation (search/tags/
  learning path); Board bulk bus mapping over the canonical `Base[N]`
  convention; flat Vivado kit download; waveform lane pin/hide controls.
- Proof: Browser-E0 only (vitest contracts + Playwright captures at
  1440×900/1366×768). No Vivado/bitstream/board claims. Golden export SHAs
  untouched. See root `RESUME.md` for the commit ledger and next queue.
- Boundary: the unpushed desktop head `65e1ff872` remains desktop-only;
  this lane never rewrites `product/redbyte-workbench-v3`. Desktop
  reconciliation is one merge of this branch.

### P2 HDL / Vivado interoperability lane (2026-08-31, cloud session)

- Branch: `claude/redbyte-product-core-convergence-n3pi6t` (base `597337b` =
  the P1 candidate head, i.e. `product/redbyte-workbench-v3` + all of PR #82),
  delivered via draft PR
  [#84](https://github.com/swaggyp52/redbyte-ui-genesis/pull/84) into the
  product branch. Stacked on the P1 candidate, so once #82 lands #84's diff
  collapses to just the P2 work.
- **P1 closeout:** PR #82 body rewritten to final P1 truth (the landed
  operational-workbench work was still listed as "remainder"); focused P1
  suites + unified build re-proven green under pinned Node 20.19.0. **PR #82
  was NOT merged** — this session's branch scope forbids pushing to the
  protected product base and #82 is a draft; it is left for Connor to
  merge/close via the GitHub UI. No production deploy.
- **P2 delivered (data + authority foundation):** versioned, migration-safe
  project format + corpus (P2-1, which also repaired 3 pre-existing round-trip
  gates against their committed goldens); first-class source/fileset model,
  persisted in the format and wired as a live store authority that
  auto-populates for imported projects, and **rendered in the Project explorer
  with honest capability tiers** (P2-2/P2-4, browser-proven); language
  capability matrix + diagnostics/source-range model (P2-3); source-backed
  module tiers + bidirectional cross-probe (P2-4); simulation provider
  architecture + bounded VCD reader with honest evidence tiers (P2-6, model
  layer); deterministic Vivado digital-twin snapshot envelope (P2-7, model
  layer); and a P3 cloud control-plane data-contract readiness **report** (no
  auth built).
- Proof: Browser-E0 only. ~215 vitest tests + one Playwright journey
  (`source-files-journey.mjs`, 1440×900). Both classroom golden Basys3 export
  gates byte-identical throughout; 0 new tsc errors per slice. Continuation
  point: `.redbyte/product-immersion/p2-hdl-interoperability/RESUME.md`.
- Remaining P2: import review-before-apply program (P2-5); the VCD Analyzer +
  cross-probe UI wiring; parameter/generic depth; constraint sets + package
  round-trip; reference project, scale/a11y hardening, legacy removal (P2-8).

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
visual hierarchy, a functional scenario composer, C.1 geometry stabilization,
and the integrated Studio reconstruction. Simulate owns named
persisted documents, a direct event timeline, optional output checks, real
deterministic replay, failure repair context, and the same generated testbench
source shown by Build & Export. The explorer, composer, waveform, and contextual
inspector remain visible as one continuous workstation. Studio Light owns
application surfaces while dark instrument surfaces are limited to the circuit
canvas, waveform, and code viewer. This does not broaden circuit, simulation,
HDL, board, or hardware support beyond the documented boundaries.

## Candidate Evidence And Exit Gates

- The current visual review record is stored under the ignored
  `.redbyte/product-immersion/studio-reconstruction/` path. It contains the
  ownership ledger, 14 exact final captures, metadata, and before/after
  comparisons at 1440x900 and 1366x768 with 100% browser zoom. User visual
  approval is still required before any next milestone or merge.
- Milestone C.1 Browser-E0 evidence is stored under the ignored
  `.redbyte/product-immersion/milestone-c1-geometry/` path. It records exact
  1366x768 and 1440x900 Timeline/Waveform geometry, Project circuit-preview
  composition, and Build & Export source visibility.
- Milestone C browser evidence is stored under
  `docs/release/evidence/milestone-c/`: eight focused captures covering the
  eight-case Full Adder scenario, checks, pass/fail/repair, generated source,
  Project/Export integration, reload persistence/staleness, and compact layout.
- Milestone B2 visual evidence remains under
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
- Milestone C migrated the bounded 39-assertion B2 selection to the accepted v3
  contract while preserving behavioral assertions. The pinned runtime remains
  Node 20.19.0; this machine currently provides Node 24.15.0, which must be
  reported as a validation caveat rather than treated as pinned equivalence.
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
- Named scenarios and their events/checks survive browser-local save, autosave,
  recovery, and reload. Portable cross-browser/archive transfer of the complete
  scenario sidecar remains unproven.
- Native visual hierarchy supports reusable HalfAdder-style modules and direct
  module navigation. Buses/named nets, code-backed modules, parameters/generics,
  and broader top-module tooling remain future depth work.
- Multiple constraint sets, broader Basys3 peripherals, and deeper compatibility
  analysis belong to later milestones.
- No Product System v3 candidate claim includes Vivado E1, bitstream E2, board
  observation E3, production readiness, or unsupervised classroom reliability.

## Next Authorized Endpoint

Complete user visual and interaction review of the integrated Studio candidate
and stop. Do not begin another feature area until the 1366x768 and 1440x900
workbench evidence and both normal-use flows have been reviewed.

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
