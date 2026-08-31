# RedByte P2 — Real HDL / Vivado Interoperability — RESUME

> Multi-session working ledger. This file is the single continuation point. Newest
> entry at the top of the **Commit ledger**. Canonical repo docs still win over this file.

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

- Working branch: `claude/redbyte-product-core-convergence-n3pi6t`, based on the
  consolidated P1 head `597337b` (= `product/redbyte-workbench-v3` + all 79 P1
  commits).
- P1 candidate remains **PR #82** (draft) — not merged here; left for Connor to
  merge/close via the GitHub UI (draft + protected base + this session's branch
  scope). P2 is stacked on top of the P1 head, so once #82 lands, the P2 PR's diff
  collapses to just P2.
- P2 draft PR targets `product/redbyte-workbench-v3`, titled
  "RedByte P2 — HDL and Vivado Interoperability".

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
