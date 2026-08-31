# RedByte P2 — Real HDL / Vivado Interoperability — RESUME

> Multi-session working ledger. This file is the single continuation point. Newest
> entry at the top of the **Commit ledger**. Canonical repo docs still win over this file.
> Authority split: `docs/ACTIVE_WORK.md` = project truth · this file = session
> continuation · PR #84 = public review truth. No fourth authority.

## Canonical state (update every chapter)

- **CURRENT HEAD:** `675c68257` (== `origin/claude/redbyte-product-core-convergence-n3pi6t`)
- **CURRENT BRANCH:** `claude/redbyte-product-core-convergence-n3pi6t`
- **CURRENT PR:** [#84](https://github.com/swaggyp52/redbyte-ui-genesis/pull/84) (draft,
  P2-only diff — 54 files — targeting `product/redbyte-workbench-v3` @ `bd70c4c`;
  base `mergeable_state: clean`). PR #82 (P1) merged into product and closed.
- **CURRENT PHASE:** P2 Phase 2 — UI integration (authorities → user-visible surfaces).
  Phase 1 (data + authority foundation) landed.
- **CURRENT ACCEPTANCE JOURNEY:** Chapter A — imported-VCD Analyzer browser journey in
  the real Simulate surface at 1440×900 and 1366×768 (not yet written).
- **ACTIVE IMPLEMENTATION:** Chapter A — mount `vcdImport` + `simulationProvider` +
  `VcdWaveformView` into the Simulate surface as a real three-zone Analyzer with honest
  provider identity. Reconnaissance of the Simulate surface in flight.
- **NEXT THREE TASKS:** (1) mount VCD Analyzer + close its browser journey [A];
  (2) source↔visual cross-probe UI [B]; (3) constraint-set UI in Project + Board [C].
- **BLOCKERS:** none. (Breaking v1→v2 format bump is *deferred by policy*, not blocked —
  it awaits an explicit `FORMAT_V2_SIGNOFF.md` decision from Connor; non-breaking legacy
  removal proceeds without sign-off.)
- **LAST BROWSER PROOF:** `source-files-journey.mjs` — PASS at 1440×900 (P2-4 visible:
  Project explorer source files with honest tiers). Chapter A journey pending.
- **LAST VALIDATION:** per-slice focused vitest green under pinned Node 20.19.0; both
  classroom golden Basys3 export gates byte-identical; unified `@redbyte/rb-apps` build
  green; 0 new tsc errors per slice. (Re-run at each Chapter close.)
- **LAST PUSH:** `881957b4e..675c68257` → `origin/claude/redbyte-product-core-convergence-n3pi6t`
  (product merged into P2 branch, content-neutral; HEAD == origin).
- **DIRTY FILES:** none (tree clean at `675c68257`).

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
