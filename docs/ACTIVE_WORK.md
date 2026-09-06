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
- **P2.5K instrument composition and high-zoom frame (2026-09-06, pushed):** the visual
  foundation from P2.5J is locked and unchanged; this pass is composition and interaction.
  **The frame is built in the reader's text size.** At 200% text the Help menu overlapped the
  command-palette entry by 60.6px and a click inside the palette's own box opened Help
  (`elementFromPoint` confirmed the theft): eleven frame values - command bar, status bar,
  activity rail, tab strip, toolbars, rows, controls, indent - were absolute px around text in
  rem. All eleven are rem now, identical to the pixel they replace at a 16px root. The bar
  composes against the window measured in the reader's own text size, because `rem` inside
  `@media` resolves against the browser's *initial* font size and can never see an enlarged root
  (measured: `matchMedia('(max-width: 64rem)')` false at root 32px on a 1366px window). Below 64
  text widths the five menus fold into one that keeps every command, arrow keys and roving focus.
  Three pixel guesses went with it: a `max-width: 1400px` rule reduced the save-state word to a
  7px dot on every 1366-wide machine, a `max-width: 899px` rule hid the whole centre region, and
  the brand mark computed to 0px at 200%. The run intent was clipped in silence - "Compare"
  rendered as "Cor" - because a segmented control was allowed to shrink below its buttons.
  A new probe (`packages/rb-e2e/chrome-priority-probe.mjs`) asserts the six-item priority order
  at 1440x900, 1366x768, 1024x720 and at root 32px: **0 overlaps, 0 clipped children, 0 stolen
  clicks.**
  **Five outside shell gates classified rather than labelled** - all Category B obsolete
  assertions, each dying on its first assertion, each naming a control deleted with
  `IdeLeftRail.tsx` in `24de703b6` or a pixel constant the shell stopped producing; none a
  product defect. `ide:gate:shell-chrome-contract` is deleted and its two unique facts moved
  into `ide-shell-layout-integrity`, which asserted the exact inverse. Two harness defects fell
  out: the gate harness accepted any status below 500, so an empty `apps/playground/dist` served
  a 404 that counted as ready and every selector then looked missing in any of the ~190 gates
  routed through it; and the shell published `data-console-state="expanded"` whenever the console
  existed. Still red at baseline on their own assertions and **not** yet classified:
  `ide:gate:export-e2e-contract`, `ide:gate:action-first-entry-surfaces`,
  `ide:gate:export-artifact-direct-preview`.
  **Surfaces:** the Design inspector scrolled its own subject off the top (304px of overflow in a
  dock that was itself the scroller) and now has a fixed head over one scrolling body; the
  toolbar stopped wrapping after any run; the two support docks took 992px of a 1366px window at
  200%, leaving the schematic 262px, and are now floored by their words and capped by the window.
  The **overview map took every click inside its own box, so a part in the bottom-right corner of
  the sheet could not be wired at all** - it is a presentation layer now, listed in View, off by
  default, inert while a wire is drawn. Simulate's waveform was laid out 359px below its pane
  showing 125px of 448px; the failure focus held six of the ten facts a reader needs and offered
  no way to reach fail 2; `Trace in Design` could hand Design a passing case while the surface
  said FAIL. The board had **zero focusable elements and zero ARIA roles** - Tab skipped all
  sixty-odd resources; it is a listbox with a roving tabstop (74 options, 74 labelled, 1
  tabstop), "Next unmapped" means the next one after this one rather than the first, and the XDC
  block no longer runs 280px past the viewport inside the identity's scroller. Build & Export
  opened on a file browser with seven top-level regions in a 2241px scroll; it opens on the
  handoff dossier and one document owns the surface at a time - which reading the surface in the
  state a student reaches it in showed was only half true: **after any run, Build & Export had no
  document of its own at all**. The document host marks a navigation as being applied so the
  mode-reconciliation effect does not fight it, and cleared that marker on one condition only -
  the applied document's mode matching the mode on screen. A completed run opens the waveform
  from inside Simulate, so the marker was left set; the next workspace failed the test, returned
  early *without* reconciling, and never cleared it, so Package created no document and fell back
  to the artifact browser for the rest of the session. The marker now remembers the mode the
  navigation started in, which distinguishes an application still in flight from a spent one, and
  the acceptance journey asserts the dossier at the exact point in the student path where it was
  failing. Two more measured clippings went with it: fourteen of the twenty-four component-library
  rows showed **0px of part name** beside a legible "Boundary limited" (grid gives its auto tracks
  their content before the `1fr` track gets any), and every constraint line in the selected-signal
  card was cut at the port name - 611px of content in a 339px pane, scrolling sideways, from an
  OS-era `ide-root.css` rule whose two attribute selectors outranked the P2.5 board owner.
  **Journey inventory recomputed: `packages/rb-e2e` holds 29 `.mjs` files - one harness, one
  evidence-capture tool that asserts nothing, and 27 journeys. All 27 executed against one build;
  all 27 pass.** `pnpm verify:gates` exit 0 at every checkpoint; typecheck 778, unchanged.
  Label **REDBYTE INSTRUMENT-FINISH CANDIDATE / VISUAL SYSTEM LOCKED / FUNCTIONAL FOUNDATION
  PRESERVED / FEATURE BRANCH PUSHED / PREVIEW SHA VERIFIED / PR #85 DRAFT / NO MERGE / NO
  PRODUCTION**. Not delivered and stated plainly: the Board Guided/Expert split (a feature, and
  the largest single item left), the Project/Start consistency pass, the three export gates
  above, and the Design toolbar at 200% text, which is three rows - the frame no longer collides
  and nothing is clipped, but the workbench is cramped at that setting. Continuation:
  `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
- **P2.5J visual craft, spatial coherence and instrument finish (2026-09-06, desktop session,
  pushed):** a visual-system pass against Connor's ~70% verdict, on the same branch, five
  commits (`d6c67b386` → `d46d2350e`). The audit found three surface roles sharing two
  values (`--wb-paper` == `--wb-surface` == `#fbfbfa`, widest palette step 1.09:1), four type
  families reaching the screen with IBM Plex declared three times and loaded never, and a
  200% text setting that left the page pixel-identical (WCAG 1.4.4 fail). Landed: three surface
  planes, one rem scale with 1321 declarations moved onto it and both families bundled locally,
  a Board assignment table that no longer renders 744px into a 339px pane, a Design palette that
  no longer renders 276px into a 175px box with hidden overflow, one signal table on Board
  instead of two, a Simulate scenario panel of 29px instead of 302px around a 28px header, a
  Project architecture figure sized to its drawing instead of 72% empty, one-row Design toolbar,
  no floating control over the inspector, and Package/Board/Simulate each stating their state
  once rather than three to six times.
  One functional defect found and made honest rather than hidden: **a single compatible gate swap
  in Design clears all 16 of a lab's authored expected outputs** (deliberate starter-detach rule
  in `reconcileTestbenchAfterDesignChange`, but silent, and path-dependent — running Compare once
  first keeps them). Simulate now says what happened and how to get back. Five gate assertions
  migrated to the behaviour they protected, none deleted.
  Proof: `pnpm verify:gates` exit 0; Full Adder operational, package-history, pin-planner,
  project-persistence, a11y-scale and layout-scale-probe journeys green; typecheck 778 unchanged;
  every touched suite at its exact committed baseline; 0px document overflow at 1440×900,
  1366×768, 1024×720 and 200% text. Browser-E0 only. Label: **REDBYTE VISUAL CRAFT CANDIDATE /
  FUNCTIONAL FOUNDATION PRESERVED / FEATURE BRANCH PUSHED / PR #85 DRAFT / NO MERGE / NO
  PRODUCTION.** Continuation:
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
- **P2.5H product-completion session (2026-09-05, pushed):** three product repairs, each with a contract
  test that is red without it. (1) An unchanged reload no longer reports a current run as STALE:
  `computeScenarioContentHash` hashed vector ids, which cloning and persistence drop, so a run could never
  match its own scenario after a reopen. (2) The board twin's slide switches no longer fight themselves - the
  press set the value absolutely and the click toggled it back, so clicking the lower half of an ON switch was
  a silent no-op and a centre click could never turn one off; a press that does not travel now toggles, a
  slide reads the pointer, and `data-on` is published on switches and LEDs. (3) Creating a bus no longer drops
  its bits on top of existing symbols - the spawn search clears every slot the caller will fill, with
  `BUS_MEMBER_SPACING` shared between the reservation and the creation.
  **Journey denominator reconciled: 24 files in `packages/rb-e2e`, 24 executed against one build, 23 pass,
  1 partial** (`nested-adder`: blank-project authoring stage A green, stage B layout unresolved). First
  attempt was 8 pass / 14 fail; all 14 were harness-stale against the P2.5 grammar, none a lost capability,
  and nothing was removed from the suite. **Harness portability closed:** `packages/rb-e2e/harness.mjs` owns
  browser resolution (Playwright's own on every platform, `RB_CHROMIUM_PATH` as a validated override - the 23
  copies of the `/opt/pw-browsers/chromium` Linux hardcoding are gone), `RB_BASE_URL`, and repo-relative
  evidence. Two reported product defects (node drag, hide-bottom-panel) were investigated and are not defects.
  HEAD `797bb405b`, label **INTERIM REDBYTE WORKFLOW COMPLETION / REMAINING BLOCKERS NAMED / SOURCE
  PRESERVED**. Not run this session: full vitest, both golden gates (untouched), unified build, CI. Open:
  §7 persistence beyond reload (Recent / Open Existing / Save As / Duplicate / imported open, project A/B
  isolation), §9 keyboard operation and waveform scale beyond the 200-row cap, and the module-instance spawn
  clearance. Continuation: `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
- **P2.5I product-gate closure (2026-09-06, pushed):** the local product gate is now closed.
  `pnpm verify:gates` passes end to end (exit 0, 23 suites, both classroom goldens byte-identical,
  the Lab 4 no-solution gate, and `pnpm -r build`). Its one failure, `rc:d2:basys3-bundle-gate`,
  reproduced identically at the session-start checkpoint and was classified rather than labelled:
  an obsolete assertion against the handoff pin map that `2a0b66982` deliberately rebuilt on the
  mapping projection. The behaviour it protected is asserted through the new owner, for every
  mapped signal and cross-checked against the constraints file.
  **Journey inventory recomputed from repository truth: `packages/rb-e2e` holds 27 `.mjs` files —
  one shared harness and 26 journeys. All 26 executed against one build; all 26 pass.** Nothing
  excluded, nothing partial. 6 are student acceptance, 15 seeded integration, 5 diagnostic probes,
  0 historical; separately, 10 write nothing to the store at all. The blank-project authoring
  journey went from partial to green and now asserts what it used to print: 12 wires, a reusable
  `FullAdder` module, 17 ripple-carry wires, deterministic simulation of the UI-authored design
  (0xA + 0xD = 0x17), survival across reload, and generated hierarchical VHDL binding
  `work.FullAdder`.
  **Defects closed:** the schematic was laid out 73px past its pane and the Problems console
  swallowed clicks on symbols placed low on the sheet; placement cleared a 48px gate footprint for
  symbols twice that size, so module instances stacked until some had no clickable body; the
  Design inspector hid 318-450px of its own sections with no scroller anywhere inside it; autosave
  erased stored run evidence about 700ms after any edit; explicit Save re-persisted a stale run
  through a dependency-array omission; a run made just before switching projects never reached
  disk; the status bar said "Not simulated" for a reopened project whose Simulate said RECORDED;
  and on the accessibility side `IdeButton` dropped every `aria-*` (so the replay toggle published
  no `aria-pressed`), the command palette and menubar dropped focus to `<body>`, reduced motion did
  not reach the primary/secondary buttons including the replay transport, and a signal pinned past
  the render cap could no longer be re-radixed.
  **Built-bundle proof:** `pnpm build` stamps the pushed SHA, and the Full Adder acceptance journey
  passes against the built bundle served locally and again against the deployed Cloudflare branch
  preview, at both viewports, driven through `RB_BASE_URL`.
  Typecheck unchanged at 778. Label **REDBYTE REMOTE REVIEW CANDIDATE / FEATURE BRANCH PUSHED /
  PREVIEW SHA VERIFIED / PR #85 DRAFT / NO MERGE / NO PRODUCTION**. Known limitations are recorded
  in the continuation record rather than hidden. Continuation:
  `.redbyte/product-immersion/p2-5-operational-workbench/RESUME.md`.
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
