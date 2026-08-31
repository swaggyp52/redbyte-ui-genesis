# RedByte P2 — Real HDL / Vivado Interoperability — RESUME

> Multi-session working ledger. This file is the single continuation point. Newest
> entry at the top of the **Commit ledger**. Canonical repo docs still win over this file.
> Authority split: `docs/ACTIVE_WORK.md` = project truth · this file = session
> continuation · PR #84 = public review truth. No fourth authority.

## Canonical state (update every chapter)

- **CURRENT HEAD:** `f2a3346fc` (Chapters A–C pushed) + local Chapter-D commit
  (provider bar), pushed after this chapter closes.
- **CURRENT BRANCH:** `claude/redbyte-product-core-convergence-n3pi6t`
- **CURRENT PR:** [#84](https://github.com/swaggyp52/redbyte-ui-genesis/pull/84) (draft,
  P2-only diff targeting `product/redbyte-workbench-v3` @ `bd70c4c`). PR #82 (P1) merged
  into product and closed.
- **CURRENT PHASE:** P2 Phase 2 — UI integration **complete**: Chapters A–H + the
  format-v2 sign-off artifact all landed and pushed. Final closeout next.
- **CURRENT ACCEPTANCE JOURNEY:** `complex-import-journey.mjs` — PASS (23 real-UI steps,
  no store injection): import a multi-file project through the real file input, then
  walk the whole spine exercising source files, bidirectional cross-probe, provider
  selection, the VCD Analyzer (cursor/radix/search/pin), constraint sets (seed/activate/
  rename), and export — one shell, no overflow, no page errors.
- **ACTIVE IMPLEMENTATION:** none — closeout. (Post-signoff: the v2 format bump, only if
  Connor approves via `FORMAT_V2_SIGNOFF.md`.)
- **NEXT THREE TASKS:** (1) final closeout report; (2) await Connor's format-v2 decision;
  (3) the remaining pre-existing P2 depth items (import review-before-apply program end-to-
  end, parameter/generic depth) as a later slice.
- **BLOCKERS:** none. (Breaking v1→v2 format bump is *deferred by policy*, not blocked —
  it awaits an explicit `FORMAT_V2_SIGNOFF.md` decision from Connor; non-breaking legacy
  removal proceeds without sign-off.)
- **LAST BROWSER PROOF:** `sim-provider-journey.mjs` — PASS at 1440×900 and 1366×768.
  Screenshots under `evidence/chapter-d/` (local/ignored). Chapters A/B/C journeys still PASS.
- **LAST VALIDATION:** Chapter D — 8 vitest green under pinned Node 20.x
  (SimulationProviderBar 3, VcdAnalyzerPanel 5 incl. the additive `isActiveProvider`);
  unified `@redbyte/rb-apps` build green; 0 new tsc errors. Pre-existing baseline reds unchanged.
- **LAST PUSH:** `efd12f246..f2a3346fc` (Chapter C). Chapter D push pending at chapter close.
- **DIRTY FILES:** Chapter D working set (SimulationProviderBar.tsx, VcdAnalyzerPanel.tsx,
  simulationProviderBar.test.tsx, VerifySurface.tsx, verify CSS, sim-provider-journey.mjs)
  — about to be committed.

## Program

Turn RedByte from a browser-native logic workbench into a **source-interoperable**
engineering system: a versioned, migration-safe project format; a first-class HDL
source/fileset model; bounded multi-language parsing with honest capability tiers;
source-backed modules with source↔visual cross-probe; an Import/Review/Recovery
program; a deterministic Vivado *digital-twin snapshot envelope* (generated
externally, never synthesized in-browser); a simulation *provider* architecture
(Browser Logic + Imported VCD) with honest evidence tiers; and a P3 cloud
control-plane **data-contract readiness report** (no auth implemented).

## Hard boundaries (never violate)

- **Browser-E0 honesty.** Never claim a Vivado run, synthesis, implementation,
  bitstream, timing, or programmed board happened in-browser. The virtual board is a
  browser logic mirror. Imported Vivado artifacts are *snapshots generated outside
  RedByte*, presented as evidence tiers — not as work RedByte performed.
- **One authority per concern.** `useProjectRuntime` (persisted), `state.sim`
  (ephemeral experiment), `hardwareMappingV2` (mapping), `hierarchy` (design), and
  the new **source model** each have exactly one writable owner. Everything else is a
  read-model/adapter.
- **Import is review-before-apply.** No silent replacement of user data; no Tcl
  execution; no source mutation during inspection.
- **Determinism.** No wall-clock timestamps or random IDs in serialized/exported/
  hashed paths. Format serialization is canonical and stable.
- **Pinned runtime** Node 20.19.0 / pnpm 10.24.0 for all validation.
- **Branch scope.** Push only to `claude/redbyte-product-core-convergence-n3pi6t`.
  Do not push to `main` or `product/redbyte-workbench-v3`. Do not deploy production.
- **No university authentication** in P2. P3 readiness is a *report* only.

## Branch / PR posture

- Working branch: `claude/redbyte-product-core-convergence-n3pi6t`.
- **Stack consolidated (2026-08-31, cloud session).** PR #82 (P1) was merged into
  `product/redbyte-workbench-v3` with a merge-commit (`bd70c4c`, no history rewrite,
  no force push, no production deploy); #82 auto-closed with a final integration
  comment. The product base (`597337b` P1 head) is preserved as an ancestor, so P2's
  diff collapsed to **P2-only** (54 files). Product was then merged into this branch
  (content-neutral, `675c68257`) and pushed normally.
- P2 draft **PR #84** targets `product/redbyte-workbench-v3`, titled
  "RedByte P2 — HDL and Vivado Interoperability". Body rewritten to the consolidated
  P2-only state.
- **No new stacked PR.** All P2 UI-integration work continues on this one branch / PR.
- **Check-in loop terminated.** All recurring check-ins / self-rearming triggers were
  cancelled and PR-activity auto-wake unsubscribed. CI is inspected only after a
  meaningful pushed chapter, at final closeout, or when GitHub reports an actual
  failure — never on a polling cadence.

## Slice plan (see task list #24–#31)

1. Versioned round-trip-safe project format + migration corpus. **(first)**
2. First-class source/fileset model (one source authority).
3. Language capability matrix + bounded parsing & diagnostics.
4. Source-backed modules + source↔visual cross-probe + params/generics.
5. Import / Review / Recovery program.
6. Simulation provider architecture + VCD import/Analyzer.
7. Vivado digital-twin snapshot envelope + constraint sets + package round-trip.
8. Reference project, scale/durability, a11y, legacy removal, P3 readiness report.

## Validation ritual (every slice)

- Focused vitest suites for the slice, under pinned Node 20.19.0.
- Per-file typecheck delta vs the branch point (raw `tsc` has a large pre-existing
  baseline the vite/esbuild build tolerates; compare counts, don't chase the baseline).
- Unified `@redbyte/rb-apps` build stays green before any push.
- Browser proof (Playwright, real UI, store read-only) for user-visible behavior;
  logged in `BROWSER_JOURNEYS.md`.
- Push every 3–5 coherent commits with `-u`.

## Commit ledger (newest first)

- **Chapter F (acceptance) — complex imported-project journey, real UI only.**
  `complex-import-journey.mjs`: 23 real-UI steps with **no store mutation to
  bypass user actions**. A multi-file project (VHDL + Verilog + two XDC sets +
  circuit) is opened through the actual project file input, then the whole spine
  is exercised by real clicks/types: Project (4 source files across design +
  constraint filesets, top-module cross-probe Exact, bidirectional highlight both
  directions), Design, Simulate (provider bar; import a VCD; select Imported;
  cursor measurement 0xA@5; radix→dec; search; pin-to-narrow; switch back to
  Browser Logic de-emphasizes the Analyzer), Board & Constraints (2 sets seeded
  from the imported XDC; activate; inline rename), Build & Export, then back to
  Project with the artifacts intact — exactly one workbench shell, no overflow,
  no page errors. PASS at 1440×900.
- **Chapter H (hardening) — accessibility + scale.**
  Honest **bounded rendering** so the new lists cannot explode the DOM at scale
  (never a silent truncation — each cap shows "showing N of M" + how to narrow):
  the VCD Analyzer SIGNALS/WAVEFORM/MEASUREMENTS zones cap at 200 signals (a
  500-signal VCD reports 500 but renders ~200 with a pin/filter hint);
  ProjectSourceFiles caps each fileset group + the compile order at 100. New
  `hdlInterop.scale.test.ts` proves the pure models at the specified scales
  (500-signal VCD measured at a cursor; 1000-file source model grouping +
  compile order; a 200-module cross-probe built deterministically with 200 exact
  module links). Proof: `a11y-scale-journey.mjs` PASS at 1440×900 and 1366×768 —
  exactly one `<main>` landmark, the 500-signal bounding + hint, the new controls
  keyboard-focusable, reduced-motion, and no horizontal overflow including at an
  effective 200% zoom (halved viewport). Unified build green; 0 new tsc errors.
- **Chapter G (UI integration) — project-format migration UX.**
  Opening an older-format project no longer upgrades silently. New pure
  `export/formatMigrationPlan.ts` (`analyzeProjectForMigration` +
  `recordFromPlan`) sits on the existing migration ladder and reports
  current / needs-migration / too-new / invalid without mutating the input.
  New `components/FormatMigrationDialog.tsx`: an honest "Project update
  required" modal stating the from-version, listing the exact changes, with
  Cancel / Export original backup / Open upgraded copy. Wired into IdeApp's
  real file-open (`handleProjectFileSelected`): the raw document is analyzed
  before `decodeRBProject`; a needed migration raises the dialog instead of
  loading. **Open upgraded copy** loads a working copy (original file
  untouched) and writes a durable `lastSavedAt` record ("Upgraded … v0 → v1");
  **Export original backup** hands back the byte-identical original as a
  download; **Cancel** loads nothing. 8 unit/component tests. Proof:
  `migration-journey.mjs` PASS at 1440×900 and 1366×768 (real file input:
  dialog, byte-identical backup, upgraded-copy load + record, cancel, no
  overflow). Unified build green; goldens untouched.
- **Format v2 sign-off artifact + legacy-removal posture.**
  New root `FORMAT_V2_SIGNOFF.md`: the single sign-off-gated item, prepared for
  Connor's decision (exact change, the two affected classroom golden SHAs and how
  to regenerate them, the already-tested `promoteToolchainInput` migration body,
  round-trip guarantees, rollback options incl. a dual-emit bridge, user-data
  risk, and a recommended decision to land v2 as its own reviewed change — never
  bundled into P2's UI work). **Not implemented; format version stays 1 and both
  goldens byte-identical on this branch.** Legacy-removal posture: the primary
  legacy is the `hdl` ↔ `sourceModel` duplication, which is *exactly* what the
  gated v2 bump retires — so it is not deleted here (that is the gated change).
  P2-C already made a real non-breaking correction in this area
  (`promoteToolchainInput` natural filesets). No speculative dead-code deletions
  were made, to keep every P2 commit regression-free.
- **Chapter E (parity proof) — one workbench grammar for native and imported.**
  Verified there is **no second app**: no `ImportedProjectSurface`, `VCDApp`, or
  second workbench root anywhere in the source. Parity already held (imported
  projects load through the same `loadFromProject` path and flow the same
  surfaces); this chapter proves and locks it. New `parity-journey.mjs` loads an
  imported project (VHDL + XDC + circuit) and walks all five stages via the same
  `mode-button-*` controls, asserting each stage's `ide-mode-*` marker, that the
  imported artifacts appear in the **shared** surfaces (source files + cross-probe
  in Project, provider bar + VCD Analyzer in Simulate, constraint sets in Board),
  and that there is exactly **one** `.ide-workbench-shell` and one `<main>`
  landmark at every stage with no horizontal overflow. PASS at 1440×900 and
  1366×768. No source change — parity is a property of the existing single
  workbench, now under test.
- **Chapter D (UI integration) — simulation-provider selection + run provenance.**
  New `components/SimulationProviderBar.tsx` mounted in the Simulate surface:
  two provider chips over the existing `simulationProvider` model — Browser Logic
  (Browser-E0, executes the browser model) and Imported VCD (imported-external,
  replayed/never executed) — with the Imported chip disabled until a VCD is
  loaded, the active provider named as the run-of-record, and a provenance line
  stating the active provider's honest evidence label + tier note. Selection is
  local surface state; the imported provider uses the waveform's own descriptor
  (no double-labeling). `VcdAnalyzerPanel` gained an additive `isActiveProvider`
  (default true) that shows a muted "not the active provider" strip + dims the
  Analyzer when Browser Logic is the run-of-record. 3 component tests (+5
  Analyzer tests still green). Proof: `sim-provider-journey.mjs` PASS at 1440×900
  and 1366×768. Unified build green; 0 new tsc errors.
- **Chapter C (UI integration) — constraint sets live in Board & Constraints.**
  The pure `constraintSets` model (P2-7) is now a persisted store authority with
  a real Board & Constraints UI.
  - Store: `constraintSets: ConstraintSetsDocument` on `useProjectRuntime`
    (single owner) + `addConstraintSet` / `removeConstraintSet` /
    `renameConstraintSet` / `setActiveConstraintSet` actions (error-returning),
    persisted via partialize + restored via merge, reset/seeded on project load —
    **imported XDC files seed one set each**. 4 store tests.
  - `components/ConstraintSetsPanel.tsx`: list of named sets with the active tag,
    per-set parsed pin counts (bounded XDC reader), activate / inline-rename /
    remove, "Capture current pins as set" (seeded from the live generated XDC),
    and an active-set XDC preview. Honest copy: RedByte organizes constraint text,
    never runs Vivado or programs a board. 5 component tests.
  - Wiring: mounted in `HardwareSurface` (Board & Constraints) below the mapping
    work area; IdeApp threads the store doc + live `xdcText` + the four actions.
  - **Correctness fix:** `promoteToolchainInput` now places each imported source
    in its language's natural fileset (XDC → constraint, Tcl → utility) instead of
    forcing `design` — so imported constraints classify correctly (also improves
    the Source-files view and the cross-probe constraint source). Source-model +
    round-trip suites stay green; export goldens untouched (imported projects
    derive their source model; only file-serialized sourceModels change, and none
    of those are in the golden fixtures).
  - Proof: `constraint-sets-journey.mjs` PASS at 1440×900 and 1366×768 (real load
    path): two sets seeded from imported XDC, activate, inline rename, reload
    preserves both sets + active choice, remove-the-active falls back to the first,
    no horizontal overflow. Unified build green; 0 new tsc errors.
- **Chapter B (UI integration) — source ↔ visual cross-probe live in the Project explorer.**
  The pure `sourceCrossProbe` model (from P2-4, previously consumer-less) now
  drives a real bidirectional cross-probe UI.
  - Extended `sourceCrossProbe.ts` with an honest `CrossProbeQuality`
    (`exact/partial/ambiguous/unavailable/stale`) + `crossProbeQualityLabel`,
    and broadened `CrossProbeKind` (connection/constraint/testbench-case/
    requirement) — additive. **Also repaired a latent NUL byte** at
    `sourceCrossProbe.ts:101` (`join('\0')` → `join(' ')`) that made git treat
    the file as binary; committed from P2-4.
  - New `crossProbeBuilder.ts`: `buildLiveCrossProbeIndex` scans verbatim source
    text for `entity/module <name>` declarations → `exact` (unique) / `ambiguous`
    (multi) / `partial` (bare mention) links, plus port, instance, and
    constraint↔XDC links; `qualityForLinks` picks the best tier; a design element
    with no source match yields no link → the panel shows `unavailable`. Decoupled
    `CrossProbeDesignModule` input so it stays pure. 7 tests.
  - New `components/CrossProbePanel.tsx`: two panes (DESIGN→SOURCE, SOURCE→DESIGN)
    over one index, a 5-tier quality legend, and single-selection bidirectional
    highlight (a stable design key ties each element to its backing link, so a
    click on either side lights up the other). 5 component tests.
  - Wiring: IdeApp adapts the store hierarchy + top IO into design modules and
    memoizes the live index (a derived read-model, not a new authority),
    threaded through ProjectSurface → LoadedProjectOverview into the explorer
    aside beside the Source files. Studio-Light chrome; single-column panes fit
    the narrow explorer; responsive; no page overflow.
  - Proof: `crossprobe-journey.mjs` PASS at 1440×900 and 1366×768 (real load path):
    panel mounted, 5-tier legend, module↔source Exact, bidirectional highlight both
    directions, native-only ports honestly `Unavailable`, no horizontal overflow.
    Unified build green; 0 new tsc errors; export goldens untouched. Constraint↔XDC,
    port, and instance links are unit-proven; the browser demo shows Exact +
    Unavailable honestly (visual IO names differ from HDL identifiers).
- **Chapter A (UI integration) — imported-VCD Analyzer live in the Simulate surface.**
  The existing VCD reader + provider model + `VcdWaveformView` (previously
  consumer-less) are now integrated into the real Simulate surface — no second
  parser, no second store.
  - New pure view model `apps/ide/vcdAnalyzer.ts`: `VcdAnalyzerConfig` (pinned
    signals, per-signal radix, cursor, filter) + tolerant normalizer;
    `formatVcdValue` (bin/hex/dec/signed; reals pass through; x/z never fabricate
    a number); `analyzerMeasurements` (value-at-cursor per visible signal);
    selection/filter/clamp helpers. 15 tests.
  - New `components/VcdAnalyzerPanel.tsx`: three-zone Analyzer (SIGNALS with
    search + pin + radix, WAVEFORM = the existing `VcdWaveformView` over the
    visible signals + a measurement cursor, MEASUREMENTS table), honest provider
    identity ("Provider: Imported VCD" + "generated outside RedByte" + an explicit
    "executes nothing / never runs imported HDL or Tcl" note), empty + error
    states. 5 component tests.
  - Store authority (single owner): `importedWaveform: ProviderWaveform | null` +
    `vcdAnalyzer: VcdAnalyzerConfig` on `useProjectRuntime`, with
    `setImportedWaveform` / `setVcdAnalyzerConfig` actions, persisted via
    partialize + restored via `mergePersistedRuntimeState` (survives reload),
    seeded in the empty/example constructors, and reset on project load. 7 store
    tests. `simulationProvider.ProviderWaveform` gained an optional
    `timescaleLabel` (metadata only).
  - Wiring: `IdeApp` subscribes + binds the setters and parses a chosen `.vcd`
    via the existing `parseVcd` → `waveformFromVcd`; `VerifySurface` renders the
    panel as an independent region (any verify mode). Studio-Light chrome, dark
    instrument waveform; responsive (single column < 900px).
  - Proof: `packages/rb-e2e/vcd-analyzer-journey.mjs` — PASS at 1440×900 and
    1366×768, driving the real file input (no store injection): mount → load →
    three zones → cursor measurement (data=0xA @ t=5) → radix→dec (10) → pin/search
    → reload preserves waveform + config → unusable file → honest error → no
    horizontal overflow. Unified build green; 0 new tsc errors; goldens untouched
    (no export-format change).
- **P2-6 (UI component) — VCD waveform view.**
  `components/VcdWaveformView.tsx`: the core imported-VCD Analyzer display over a
  `ProviderWaveform` (from `waveformFromVcd`) — the honest evidence caption
  (imported-external tier, "generated outside RedByte"), each signal with its
  width, and a compact per-signal value-change timeline; renders nothing without
  a waveform. 2 component tests; 0 tsc errors. Wiring a VCD file input + mounting
  it in a surface is the follow-on.
- **P2-5 (UI) — import review-before-apply panel wired into ImportSurface.**
  New `components/ImportReviewPanel.tsx` (read-only projection of an
  `ImportReviewPlan`: apply kind, per-source fileset/tier/action, blockers,
  Tcl-never-executed flag, and the standing invariants line). Wired into
  `ImportSurface` — an `importReviewPlan` `useMemo` built from `parsedHdl` +
  `xdcText` + `effectiveReconstructionLevel` + `importBlockerReasons`, rendered
  inside the pending-apply review block above the blocker callout. Styled in
  `import-recovery-workspace-v3.css`. Proof: 2 component tests + 28 ImportSurface
  suite tests green (no regression); type-clean; build green. The end-to-end
  browser journey is deferred — Import is a utility action, not a `mode-button-*`,
  so driving it needs the utility-entry path; the mount sits inside the existing,
  already-rendering pending-apply block.
- **P2-4 (model layer) — module parameters / generics.**
  `apps/ide/moduleParameters.ts`: represent declared parameters (name, kind,
  default) and instance bindings, and resolve the effective value
  (binding → default → unset) — the depth the bounded parsers drop.
  `parameterKindFromTypeName`, `normalizeParameters`/`normalizeBindings`
  (dedup + stable sort), `resolveParameters`, `validateBindings` (binding for an
  undeclared parameter is an error), `allParametersResolved`. No expression
  evaluation — declaration + override only. 5 tests; 0 tsc errors.
- **P2-8 (proof) — project-format scale/durability.**
  `export/__tests__/projectFormat.scale.test.ts`: a 402-node + 80-source project
  round-trips losslessly (`decode(encode(p)) ≡ normalize(p)`) and re-encodes
  byte-identically; a 200→400 linearity guard rules out O(n²). Measured this
  session: encode ~8 ms, decode ~2 ms, ~167 KB serialized (see PERFORMANCE.md).
  Correctness assertions are the durable proof; absolute ms are informational.
  2 tests; 0 tsc errors.
- **P2-7 (model layer) — multiple constraint sets.**
  `apps/ide/constraintSets.ts`: a project may carry several named XDC constraint
  sets with exactly one active (mirroring Vivado constrs_1/constrs_2).
  `ConstraintSetsDocument` (`schemaVersion 1.0`) + add / remove / rename /
  setActive operations (name-derived ids, no random component; first-added
  becomes active; removing the active promotes the first remaining),
  `activeConstraintSet`, `parseActiveConstraintSet` (reuses the bounded
  `parseXdcPins` reader), and `normalizeConstraintSets` (tolerant; guarantees
  exactly one active when any exist). 6 tests; 0 tsc errors. Store-field
  persistence + XDC-set UI are follow-ons.
- **P2-5 (contract layer) — import review-before-apply plan.**
  `apps/ide/importReview.ts`: `buildImportReviewPlan` describes what an import
  *would* do without applying anything — per-source fileset + capability tier +
  action (add / preserve-opaque), blockers, and whether confirmation is needed.
  Three invariants are structural and cannot be flipped by a caller:
  `executesTcl: false` (Tcl is never run), `mutatesInspectedSource: false`
  (inspecting never edits source), and replacing an existing project always
  `requiresConfirmation` (no silent replacement). HDL that does not reconstruct
  is preserved opaquely, never silently dropped. `summarizeImportReview` for the
  header. 6 tests; 0 tsc errors. Wiring this plan into the ImportSurface review
  UI is the follow-on.
- **P2-7 (model layer) — deterministic Vivado digital-twin snapshot envelope.**
  `fpga/vivado/vivadoDigitalTwin.ts`: a versioned (`schemaVersion 1.0`),
  deterministic envelope for a Vivado result produced **entirely outside
  RedByte** — part, top, tool version, utilization, timing summary, and
  content-hashed artifact refs. `generatedBy` is a constant `'external'`; there
  is no code path that stamps it as in-browser work. `buildVivadoDigitalTwin`
  (sorted/deduped artifacts, omitted-when-absent optionals), `normalize`,
  `serialize` (byte-stable via stableStringify — no wall-clock; external
  generation time is a data field), `validate`, and
  `vivadoSnapshotEvidenceLabel` (always "generated outside RedByte; no
  in-browser synthesis"). 7 tests; 0 tsc errors. Constraint-set + package
  round-trip and the import-side ingestion of a snapshot are the follow-ons.
- **P2-6 (model layer) — simulation provider architecture + VCD reader.**
  - `apps/ide/vcdImport.ts`: bounded IEEE-1364 VCD reader (`$timescale`,
    `$scope`/`$upscope`, `$var`, `$enddefinitions`; scalar/vector/real value
    changes) → `VcdWaveform` with per-signal timelines, `endTime`, and
    range-carrying diagnostics. Never throws; malformed lines degrade to
    diagnostics. `signalTimeline`/`signalByReference`/`valueAtTime`. 5 tests.
  - `apps/ide/simulationProvider.ts`: `SimulationProviderInfo` with honest
    evidence tiers — `BROWSER_LOGIC_PROVIDER` (Browser-E0, executes the browser
    logic model only) and `importedVcdProvider` (imported-external, executes
    nothing). `waveformFromVcd` adapts a VCD into a neutral `ProviderWaveform`
    tagged with its tier; `evidenceCaption`, `providersComparable`. **No provider
    fabricates execution.** 5 tests.
  - Analyzer UI wiring (provider selection + rendering the imported waveform with
    its evidence caption) is the follow-on; VCD stays `planned` in the capability
    matrix until that user-facing path lands.
  - Proof (pinned Node 20.19.0): 10 tests green; 0 tsc errors. Pure logic.
- **P2-4 visible — source authority rendered in the Project explorer.**
  New presentational `components/ProjectSourceFiles.tsx`: a read-only projection
  of the store's `sourceModel`, grouped by fileset, each file badged with its
  language capability tier (VHDL/Verilog → "reconstructable", XDC → "read-only",
  Tcl → "preserved") plus the derived compile order. Threaded `sourceModel`
  through `ProjectSurfaceProps` → `LoadedProjectOverview` and fed from the store
  in `IdeApp`, mirroring the P1 `runHistory` plumbing. Styled in
  `ProjectSurface.v3.css`. 2 component tests + a browser journey
  (`source-files-journey.mjs`, PASS at 1440×900): loading an HDL-bearing project
  populates the authority and the explorer shows the sources with honest tiers.
  Regression-free (the 8 pre-existing projectSurface baseline reds are identical
  on the clean base; +2 new passing tests); 0 new tsc errors; build green.
  Note: the explorer (hence the Source files section) renders only when
  `hasCircuit` — an import with no reconstructed circuit is a P2-5 concern.
- **P2-2/P2-4 store wiring — source model is now a live persisted authority.**
  Threaded `sourceModel: ProjectSourceModel` through `useProjectRuntime`
  (state + `PersistedRuntimeState` + `RuntimeSeedState`), mirroring the P1
  `activeTop`/`exportHistory` pattern:
  - `loadFromProject` derives it via `deriveSourceModel(project)` — **imported
    projects (which carry `hdl.sources`) get a populated source model with
    honest filesets automatically, no ImportSurface change**; native/example
    projects get an empty model.
  - `setSourceModel` action (single writable owner) marks dirty-since-export.
  - `partialize` + `mergePersistedRuntimeState` persist/restore it, so sources
    survive reload; `normalizeProjectSourceModel` tolerates absent/legacy state.
  - `createEmptyProjectState` / `stateFromExample` seed an empty model.
  4 store tests (derive-on-load, setter+dirty, merge-restore, empty default).
  Proof (pinned Node 20.19.0): 46 store/persistence tests + 4 new = green;
  broad regression shows only the 7 pre-existing `history-authority` baseline
  reds (identical on the clean branch base); 0 new tsc errors; build green.
  File-save (.rbproj) inclusion of `sourceModel` for the hand-authored case
  is a P2-5 follow-on (imported projects already round-trip via `deriveSourceModel`).
- **P2-4 delivered (model layer) — source-backed module tiers + cross-probe.**
  - `apps/ide/moduleTier.ts`: `classifyModuleTier` maps a design unit to one of
    native-visual-editable / source-editable / structural-read-only /
    opaque-preserved / missing, from (is-native? has-source? language capability?
    reconstruction level?). Honest today: imported RTL that fully reconstructs is
    `structural-read-only` (no in-place source editing yet; `source-editable`
    activates automatically once a language's capability is `editable`). +
    rank/label helpers. 7 tests.
  - `apps/ide/sourceCrossProbe.ts`: bidirectional source↔visual index.
    `buildCrossProbeIndex` (deterministic), forward queries (`linksForModule`,
    `linksForNode`, `linksForSource`), reverse queries (`linkAtSourcePosition`
    returns the innermost containing link; `designTargetsForRange` for overlap).
    Built on the P2-3 range model. 6 tests.
  - Compile-order + libraries instrument already shipped in P2-2
    (`deriveCompileOrder`, `listLibraries`). Parameter/generic depth and the
    Design/Source UI wiring (rendering tiers + live cross-probe, populating links
    from parser output) are the follow-on increments.
  - Proof (pinned Node 20.19.0): 13 tests green; 0 tsc errors. Pure logic.
- **P2-3 delivered — language capability matrix + diagnostics/range model.**
  - `apps/ide/sourceDiagnostics.ts` (committed first): the repo's first
    `SourceRange`/`SourcePosition` model — there was none; existing diagnostics
    carried line/column *points* only. Offset↔position conversion, containment,
    stable total-ordering sort, summary, formatting. 11 tests.
  - `apps/ide/languageCapability.ts`: honest `LANGUAGE_CAPABILITIES` matrix
    (VHDL/Verilog/SystemVerilog = structural-subset available; XDC = read-only
    available; Tcl = opaque-preserved, **never executed**; VCD = read-only
    planned; unknown = unsupported), reconciled against a full audit of the real
    parsers (`vhdlImport`/`verilogImport`/`xdcImport`/`hdlToCircuit`/
    `importCompiler`/`ImportSurface`). `capabilityFor`, `isReconstructable`,
    `neverExecuted`, `capabilityForFile`, `summarizeModelCapabilities`. 12 tests.
  - Findings recorded in IMPORT_CAPABILITY_MATRIX.md, incl. the range-integration
    gaps to close in P2-5 (parsers emit first-match points; `XdcPinEntry.line`
    and the behavioral scan are dropped before diagnostics).
  - Proof (pinned Node 20.19.0): 35 tests green; 0 tsc errors in new modules.
    Pure logic — no runtime/format wiring, so no golden or persistence risk.
- **P2-2 delivered (format layer) — first-class source/fileset model.**
  New `apps/ide/projectSourceModel.ts`: `ProjectSourceModel` (files with
  `SourceLanguage` × `FilesetKind` × `library`, optional `topEntity`), pure
  deterministic helpers — `detectSourceLanguage`, `defaultFilesetForLanguage`,
  `sourceIdFromPath` (no random ids), `addSourceFile`, `promoteToolchainInput`
  (legacy `hdl` → design fileset/work library — the seed for the eventual v1→v2
  breaking migration), `deriveCompileOrder` (design→simulation, deterministic;
  dependency-aware ordering deferred to P2-3), `listLibraries`, `filesByFileset`,
  `validateProjectSourceModel`, `normalizeProjectSourceModel` (tolerant, stable
  sort). 15 unit tests.
  - **Format integration:** added optional `RBProject.sourceModel`, persisted
    through encode/decode **symmetrically and only when non-empty**, so every
    existing project (and every golden fixture) stays byte-identical — zero
    format drift, no version bump. `deriveSourceModel(project)` returns the
    first-class model when present, else a projection promoted from legacy `hdl`,
    so callers treat sources uniformly. 7 format-integration tests.
  - **Decision (see PROJECT_FORMAT_MIGRATIONS):** `sourceModel` is additive =
    non-breaking, so no version bump. The v1→v2 *breaking* migration (make
    `sourceModel` authoritative, retire `hdl`) is deferred to legacy removal
    (P2-8) with deliberate golden updates; `promoteToolchainInput` is already the
    migration body, staged and tested.
  - Proof (pinned Node 20.19.0): 95 tests green across source model + format +
    round-trip + determinism + both classroom golden Basys3 gates (byte-identical)
    + persistence; 0 new tsc errors (13 pre-existing baseline unchanged);
    Browser-E0 boundary untouched.
- **P2-1 delivered — versioned round-trip-safe project format + migration corpus.**
  New `export/projectFormatMigrations.ts`: `CURRENT_PROJECT_FORMAT_VERSION`, an
  ordered append-only migration ladder (`v0 -> v1` stamps the envelope onto a
  pre-versioned document), `detectRBProjectFormatVersion`, and
  `migrateRBProjectDocument` (no-op at current version; rejects newer-than-supported
  with an honest message). Wired into `normalizeRBProject` at its choke point so
  legacy documents load and current-version documents normalize unchanged (goldens
  byte-identical). Corpus fixtures under `export/__tests__/fixtures/project-format/`.
  14 new migration tests + refined the version-2 assertion in
  `rbproject-roundtrip-ide`.
  - **Bonus round-trip fix (D-003):** decode was synthesizing an *empty* hierarchy
    for hierarchy-less projects, so encode∘decode was not idempotent. Made decode
    attach a hierarchy only when the document carries one (or has legacy
    customComponents to promote), mirroring encode. This restored **three**
    previously-red gates to green with the committed goldens untouched:
    `export-reimport-roundtrip`, `rbproject-roundtrip-gate`, `project-determinism-gate`.
  - **Classified (D-004):** `ide-vivado-project-folder-contract` (folder round-trip)
    stays red — the Vivado *folder* import reconstructs `fpga.constraints.text` from
    the emitted `top.xdc`, which the manifest didn't carry. Cross-subsystem fidelity
    gap, deferred to P2-5/P2-7 (manifest-authoritative import + constraint-set model).
    Pre-existing at branch base; not an RBProject-codec issue.
  - Proof (pinned Node 20.19.0): migrations (14), decode (2), roundtrip-ide (11),
    export-reimport (7), rbproject-roundtrip-gate, project-determinism-gate, both
    classroom golden Basys3 gates byte-identical, persistence (33) — all green.
    tsc adds 0 new errors in touched files (13 pre-existing baseline remain in
    untouched functions). `@redbyte/rb-apps` build green. Pre-existing baseline
    reds unrelated to this slice: `projectRuntime.history-authority` (7),
    `verifyCommandBar.actionRowHierarchy` (4) — identical on the clean branch base.
- `597337b` P2 branch point (P1 candidate head; see PR #82).
