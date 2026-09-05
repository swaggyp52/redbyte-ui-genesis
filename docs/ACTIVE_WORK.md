---
doc_status: current
last_validated: 2026-08-31
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

### P2 HDL / Vivado interoperability lane (2026-08-31, cloud session) — COMPLETE

- Branch: `claude/redbyte-product-core-convergence-n3pi6t`. **Consolidated** —
  PR #82 (P1 — Operational Workbench Convergence) was **merged into
  `product/redbyte-workbench-v3`** with a merge-commit
  (`bd70c4cf088b5c5402d7eb535b66209616b35c4f`, no history rewrite, no force-push,
  no production deploy) and auto-closed. The product base preserved the P1 head
  `597337b` as an ancestor, so **PR #84's diff collapsed to P2-only**.
- **PR #84** ([#84](https://github.com/swaggyp52/redbyte-ui-genesis/pull/84)) —
  **open, draft, mergeable, NOT merged**; head
  `f8899a46255d1dc44a89fb11b60b62ab78be1183` (advanced from `803e2dfd0` by the P2
  truth-correction commit; this head is also the P2.5 branch point and PR #85's
  base SHA); base `product/redbyte-workbench-v3` @ `bd70c4c`. Left for Connor to
  review/merge via the GitHub UI. No production deploy.
- **CI (verified green at head `f8899a462`):** PR Fast Checks completed SUCCESS —
  "Typecheck, contracts, unified build" SUCCESS, "Preview deploy" SUCCESS,
  "Cloudflare Pages" SUCCESS, "Check deploy credentials" SUCCESS; the
  credentials-gated deploy step SKIPPED honestly.
- **P2 delivered — data + authority foundation (Phase 1):** versioned,
  migration-safe project format + corpus; first-class source/fileset model
  (single store authority, auto-populates for imports); language capability
  matrix + `SourceRange` diagnostics (Tcl never executed); source-backed module
  tiers + bidirectional cross-probe + parameters; import review-before-apply
  contract; simulation-provider architecture + bounded VCD reader; deterministic
  Vivado digital-twin snapshot envelope + multiple constraint sets; scale proof;
  P3 data-contract readiness report (report only, no auth).
- **P2 delivered — UI integration (Phase 2, Chapters A–H, all browser-proven at
  1440×900 and 1366×768):** (A) imported-VCD Analyzer live in Simulate; (B)
  source↔visual cross-probe in the Project explorer with honest quality tiers;
  (C) named constraint sets in Board & Constraints; (D) simulation-provider
  selection + run provenance; (E) native/imported parity (one workbench grammar,
  no second app); (F) 23-step complex imported-project journey (no store
  injection); (G) honest project-format migration UX; (H) accessibility + scale
  hardening (bounded rendering, one main landmark, keyboard, reduced-motion,
  effective 200%). Two writable store authorities added (`importedWaveform`,
  `constraintSets`); everything else user-visible is a derived read-model.
- Proof: Browser-E0 only. At closeout, 91 new/related vitest green across 17
  files under pinned Node 20.19.0; both classroom golden Basys3 export gates
  byte-identical; unified `@redbyte/rb-apps` build green; 0 new tsc errors per
  slice; eight real-UI Playwright journeys passing. Continuation point:
  `.redbyte/product-immersion/p2-hdl-interoperability/RESUME.md`.
- **Format v2 — gated:** `FORMAT_V2_SIGNOFF.md` (root) is prepared and **awaiting
  Connor's explicit approval**. Format version stays **1**; both classroom golden
  SHAs are byte-identical. Not implemented in this lane.
- **Next program:** RedByte P2.5 — Operational Classroom Workbench Convergence
  (turn the P1/P2 capability into a coherent, classroom-usable workbench; not P3
  cloud, not format-v2). Branch: `claude/redbyte-operational-workbench-convergence-*`,
  stacked on PR #84 until it merges.

### P2.5 Operational Classroom Workbench lane (2026-08-31, cloud session) — IN FLIGHT

- **Branch:** `claude/redbyte-operational-workbench-convergence-w9k2r4` (branch
  point `f8899a462` = PR #84 head). **PR #85**
  ([#85](https://github.com/swaggyp52/redbyte-ui-genesis/pull/85)) — open, draft,
  mergeable, NOT merged; base `claude/redbyte-product-core-convergence-n3pi6t`
  (temporarily stacked on PR #84; **retarget to `product/redbyte-workbench-v3`
  only after #84 merges — never before, and never by an autonomous session**).
- **Checkpoint:** the six-commit Slice 0–3 checkpoint (`8a5cbef74` → `b952d46b`),
  then the local ThinkStation session: `c3bc076c6` docs truth-correction →
  `b5453b2a2` failure-diagnosis authority (floating output = structural) →
  `1c5629d54` investigation record → `3d65bf423` run-intent selector + structural
  blocking (CI green under Node 20.19.0) → `583fef846` FPGA-part board-owned →
  `04b980b90` UI-only Journey A core.
- **P2.5E/P2.5F desktop sessions (2026-09-02 → 2026-09-04, not pushed):** the signature
  workbench reconstruction on the same branch — Universal Navigator (Ctrl+K), one Problems
  ledger, Start Center as a library, Design layers / bus brackets / trace, one Waveform command
  bar with edge stepping, Board layers, Case Lab multi-select with the followed signal as a
  column, and the field-identity repair (authored expectations on hyphenated io-row ids such as
  the hierarchical adder's `carry-out` were silently pruned on every Simulate write). HEAD
  `311ed2467`, 68 commits ahead of origin, label **INTERIM REDBYTE MAX-DEPTH RECONSTRUCTION /
  NOT A REVIEW CANDIDATE / NOT PUSHED**. Browser-E0 only; both goldens byte-identical; format
  version 1. Continuation and open list:
  `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
- **P2.5G desktop session (2026-09-04, not pushed):** product completion on the same branch — Simulate
  playback + live readout, board twin follows the tick, guided Board mapping loop, failing checks on the
  schematic, Handoff dossier with figures and click-through, Runs ledger truth, Architecture isolate,
  keyboard editing, and a three-lens reviewer round with every P0/P1 repaired. Export lint repaired at the
  root (shared row-id rule). HEAD `bf051d808`, 81 commits ahead of origin, label **INTERIM REDBYTE PRODUCT
  AND RELEASE CONVERGENCE / SOURCE PRESERVED / EXACT CONTINUATION RECORDED**. The §16 local product gate
  is not met; the GitHub/site/Cloudflare phase was not started. Continuation and open list:
  `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
- **P2.5H away-mode session (2026-09-05, pushed as checkpoints):** source preserved remotely first
  (`eab7f8c1f` pushed, safety tag `safety/redbyte-away-mode-eab7f8c1f`, PR #85 body truthful, branch
  preview `https://claude-redbyte-operational-w.redbyte-ui-genesis.pages.dev` SHA-verified). P0: run
  evidence is scoped to its owning project (stamped runs/ledger, foreign evidence dropped on rehydrate,
  Save As re-owns), one `deriveRunScope` read-model names why evidence is stale, a reload keeps an
  unchanged run current, and a fresh starter load is now the canonical document rehydration produces
  (row order, V2 ids/labels, vector keys). Then Waves One–Four on the same branch: the Cases/Waveform deck
  composite with a resizable splitter, evidence state words (RUNNING / REPLAYING / RECORDED · CURRENT / STALE),
  waveform buses / radix / expected overlay, timing run length + generated lanes + reset modes, the Board
  camera and the Constraints tool (signal ↔ constraint ↔ XDC line), the Package provenance graph and
  file-by-file comparison, and the Simulate inner-grid owner (`simulate-instrument.css`; 265 dead verify
  rules retired from `ide-root.css`, `!important` 3489 → 3008), and the Design inspector as named sections
  (Identity → Actions → Selection details → Connectivity → Evidence → Mapping → Source → Related; board
  relations name the package pin), and a census-driven legacy CSS deletion (1,909 rules whose classes no element
  renders; `ide-root.css` 32,786 → 24,329 lines; owner record `css-owner-record-w10.json` beside RESUME).
  `ide-persistence-contract` passes again (harness opens File → Open Starter…; the overview hash fact carries
  `ide-project-hash-short`); the shell layout-integrity and workbench-hierarchy gates were rewritten to the
  P2.5 grammar (workspace rail, contextual Design inspector, package files as the work object) and pass at
  1366×768 / 1440×900 / 1920×1080; Package keeps one primary action. Finally the Full Adder operational journey now
  runs the whole acceptance path UI-only at both viewports — Board mapping loop, a real 18-entry package download with
  its SHA, and reload — which found and fixed one staleness authority split (Simulate said CURRENT while the status bar
  and Package said stale), an inoperable driver row on the trace path, a replay-mode deck collapse, and a shell gate
  that toggled a board input mid-assertion.
  Accessibility and scale are now proven by a journey that runs on this machine (23 of 24 e2e journeys were
    pinned to a cloud-only browser path), which found that imported .vcd evidence had become unreachable — the loader
    only rendered once a file was already imported — now fixed. HEAD `57b740ee3`, label **INTERIM REDBYTE AWAY-MODE CONVERGENCE /
  SOURCE PUSHED / NOT A RELEASE CANDIDATE**. Away-mode freeze in force: no merge/retarget/main/product/
  production/site changes. Continuation: `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
- **Exact proof boundary (Browser-E0, honest):** the **UI-only Journey A core** is
  proven (`full-adder-operational-journey.mjs`, both viewports, zero store actions):
  first use → Start a Lab → Lab 3 Full Adder → Design → Compare PASS → inspector
  gate-swap XOR→OR → Compare FAIL with a concrete mismatch → Trace in Design →
  repair → Compare PASS. The Observe/Compare run intent is a real, authoritative,
  visible control. Still UNPROVEN through the UI: an explicit author-a-check step;
  Board mapping; trusted export; HDL/XDC/testbench inspection; browser download;
  reload/resume. No Vivado/synthesis/timing/bitstream/hardware claim.
- **Remaining acceptance work:** the author-a-check step + the journey tail
  (Board mapping → trusted export → download → reload); the Board & Export surface
  convergence (Sections 6 & 8, a deliberate design pass); the baseline-red
  disposition (verify ~25, labday, `projectSurface.submission`/`continuity`); and
  the five-lab / import / persistence journeys.
- **Runtime:** the repo pin **Node 20.19.0** is available locally as a portable
  gitignored runtime at `.redbyte/tools/node-v20.19.0-win-x64`; all local
  validation (including both golden Basys3 gates) now runs under it, and cross-
  platform Playwright works on Windows.
  CI: PR Fast Checks run #81 SUCCESS at `b952d46b`; PR #84 head `f8899a462` green.
- **Boundary:** format version stays **1** (v2 gated behind `FORMAT_V2_SIGNOFF.md`);
  both classroom goldens byte-identical; one writable authority per concern; no
  second store/parser/app/shell; no cloud/auth; **do not merge or retarget PR #84
  or PR #85, push to `main`/product, or deploy production.**
- Continuation point:
  `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.

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

The P2 HDL/Vivado interoperability baseline is **complete** (PR #84, P2-only,
open/draft/mergeable/unmerged, CI green at `f8899a462`). **RedByte P2.5 —
Operational Classroom Workbench Convergence** is now **in flight** (PR #85, six
commits on the `f8899a462` branch point; see the P2.5 lane above): turn the P1/P2
capability into a coherent, practical, classroom-usable workbench (Project
start/resume, the Design↔Simulate repair loop, Board & Export as real workspaces,
the five Gannon pilot labs). This is **not** P3 cloud work, **not** the format-v2
migration (still gated behind `FORMAT_V2_SIGNOFF.md`), and **not** another
feature-breadth campaign. Do not merge or retarget PR #84 or PR #85, push to
`main`/product, or deploy production without Connor's explicit approval.

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
