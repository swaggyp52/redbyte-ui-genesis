---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Unified Workbench v3 product and acceptance contract
---

# RedByte Unified Workbench v3

> **SUPERSEDED.** This is the v2-RC-era workbench contract. The current product
> contract is `docs/product/RED_BYTE_V3_PRODUCT_SYSTEM.md` (five workspaces:
> Project / Design / Simulate / Board & Constraints / Build & Export).

## Program boundary

Unified Workbench v3 replaces RedByte's disclosure-and-rail interaction architecture with one stable engineering-workspace grammar. It is a Browser-E0 product reconstruction based on preserved local checkpoint `14429ed61f5a1bc90a796b0bdf646633668381c3`.

The original visual/composition program did not intentionally change simulation truth, expected-output semantics, pin-mapping authority, project format, generated VHDL/XDC/testbench/Tcl/ZIP bytes, goldens, Vivado execution, bitstream generation, or Basys3 observation. The RC authority addendum below supersedes that byte-invariance statement only for the bounded manual/custom sequential runtime and generated-testbench projection. Nothing in this program may be pushed or deployed without separate approval.

The RedByte-owned spine remains:

```text
Project -> Design -> Verify -> Map Pins -> Export
```

Import is a recovery utility.

## RC authority addendum (2026-07-22)

The paragraph above defines the original v3 visual/composition program. The later RC authority hardening is narrower but intentionally changes browser authority and generated projection behavior where prior surfaces could disagree. Its current integrated pre-doc source baseline is `0788044cbdf2699520d90a3428f2e5034dc73cab`; final reconstructed release certification is pending.

The RC contract adds these obligations:

1. **Testbench-document authority.** Every named Verify document owns its combinational cases or sequential timeline and, when applicable, a browser-local sequential policy (`overrideMode`, `runCycles`, `activeEdge`, `resetBehavior`, source/execution type, signal/reset identity, and `startLevel`). Save/reload, duplicate, rename, repair, and compatible Design edits preserve that intent. Rising/falling/high/low pulse semantics stay distinct. The policy remains outside portable `RBProject`; a shared materializer produces the execution vectors consumed by runtime Verify, bring-up expectations, and generated `testbench.vhd` together with the resolved clock/schedule projection. Auto `runCycles`, automatic reset behavior, resolved clock data, starting level, and authored stimulus may change derived package bytes, Export freshness, and prior-receipt authority.
2. **Rising-edge execution.** Manual/custom rows drive the resolved clock with the authored value and are sampled as settled steps. Only a low-to-high transition advances the supported rising-edge state model. Repeated high, high-to-low, repeated low, and flat-low stimulus hold state; an authored falling transition is supported stimulus, not falling-edge-triggered capture. Auto materializes cycle 0 and its selected run cycles, and each Auto report row and generated VHDL assertion is post-rising-edge. An automatic reset sequence is explicit in those materialized vectors—cycle 0 asserted and later cycles deasserted when applicable—not a hidden runtime reset prelude. Manual/custom execution also injects no hidden reset.
3. **Mapping/package agreement.** One deterministic semantic mapping projection owns logical signal ID/label, direction, artifact port, board resource, package pin, I/O standard, exact XDC line, requirement, and conflict state. Map Pins, Export, XDC/README/EXPECTED_IO, the embedded manifest, and manifest-first Import may not invent competing mappings.
4. **Export trust receipt.** Export keeps structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded` independent. Verify evidence currentness (`current`, `missing`, `stale`, or `failed`) is an upstream classification, not an Export enum. A current download requires the exact package-source fingerprint, project/Verify hashes, mapping currentness, download kind, trust classification, and SHA-256 package hash. Downloading a draft cannot make it trusted.
5. **Manifest-first recovery.** Export refreshes the embedded `project.rbproj.json` with the generated `top.vhd` and `top.xdc` that ship beside it. Import restores that manifest first. Canonical parser-expanded identities such as `SW[1]` and `LED[1]` may take pins from the manifest's embedded XDC only; loose sibling XDC is transport evidence, not restore authority.
6. **Interaction/readability.** Direct Design port targets are at least `24x24`, dense clusters are at least `32x24`, and both are keyboard operable. Verify waveform transport is at least `36x36` with `13px` labels at laptop viewports. Map Pins names all participants in a conflict. Export answers **What should I submit?** in the first viewport without pretending to know a course's LMS policy.

Integrated source `0788044cb` passes the touched Node `20.19.0` / pnpm `10.24.0` authority matrix (`20/20` files, `258/258` tests), typecheck, unified build, and focused sequential authority, mapping/package agreement, custom-clock ZIP, preservation, Verify repair, Export trust, Import, ZIP recovery, and wire-interaction gates. Historical pre-sequential `f4f7ca8f3` passed the earlier `36/36`, `477/477` matrix. These are source-checkpoint facts only. Documentation changes the tree; final exact-SHA reconstruction, the uninterrupted classroom aggregate, blind Round 2, professor/QA disposition, PDF inspection, push/PR, and required remote checks remain pending.

The RC remains Browser E0 only. It does not provide fresh Vivado, bitstream, programming, Basys3 observation, E1, E2, or E3 proof. Guided 4-Bit Adder and Hardware Mapping Assistant v2 are excluded.

## Hardening ticket

- **Title:** Replace the rail-and-disclosure interaction model with Unified Workbench v3.
- **Owner:** Connor Angiel.
- **Surface:** Shared shell, Project, Design, Verify, Map Pins, Export, Import.
- **Journey segment:** Complete student workflow from project selection through Browser-E0 package handoff.
- **Mode:** Student Browser E0.
- **Environment:** Windows, Chromium, Node `20.19.0`, pnpm `10.24.0`; fresh and resumed browser contexts.
- **Historical predecessor behavior:** At checkpoint `14429ed61`, core work changed shape around collapsible docks, floating edge toggles, nested disclosures, duplicated command regions, and passive status fragments. Verify behaved like a dense quiz/control grid rather than a simulation workspace. Those rails, docks, restore controls, and `Flow` affordances are evidence of the superseded architecture, not the current v3 runtime.
- **Expected behavior:** Every surface uses the same stable frame, makes one primary work object dominant, exposes one primary action, keeps recovery direct, and reserves pills for semantic states.
- **Severity:** P1 product architecture.
- **Reproducibility:** Always in the local `14429ed61` checkpoint.
- **Full-program proof bar:** Three complete source-blind student trials, a blind Broken XOR trial, professor review, accessibility/viewport review, four-viewport v3 gate, affected focused tests/gates, unified build, full classroom aggregate, and docs/encoding/diff checks. The current closeout is a major local phase with a partial usability lab, not completion of that full-program proof bar.

## Shared structural grammar

### Top product bar

Always visible:

- RedByte
- project name
- board target
- save state
- Import utility
- Help

### Horizontal stage navigator

`Project | Design | Verify | Map Pins | Export`

Each stage may show only `current`, `complete`, `attention`, or `blocked`. There is no permanent workflow side rail and no status sentence beneath each stage.

### Page header

Every surface exposes:

- page title
- one-sentence job definition
- one semantic status
- one primary action
- at most one recovery action

### Workspace

The primary work object receives all remaining page space. Core workflow may not depend on `<details>` / `<summary>`, floating edge toggles, manual Hide/Show layout controls, duplicate command strips, or a permanent footer console.

Essential text is at least `14px`; supporting text and metadata are at least `13px`. Routine targets are at least `36px`; primary targets at least `40px`.

## Surface definitions

### Project

- **Primary object:** textual engineering overview.
- **Stable regions:** identity, Design/Verify/Map Pins/Export summary, next action, secondary project-changing actions.
- **Primary action:** continue to the owning incomplete stage; first launch uses Start a Lab.
- **Secondary actions:** Build Fresh, Open Starter, Import, Open Existing.
- **Empty state:** neutral first launch with one primary and visible secondary paths.
- **Blocked state:** no project or no usable design boundary.
- **Completion:** a project is loaded and the next incomplete stage is clear.
- **Recovery:** choose another project source without mutating current work silently.
- **Does not belong:** pin editors, waveform controls, generated-file diagnostics, floating workflow-orientation cards.

### Design

- **Primary object:** circuit canvas.
- **Stable regions:** `200-220px` component library, flexible canvas, `240-280px` inspector, direct toolbar.
- **Primary action:** edit the circuit.
- **Secondary actions:** Open Verify; open dedicated Diagnostics.
- **Empty state:** stable library, blank canvas, overview inspector, direct first placement.
- **Blocked state:** empty/disconnected circuit or blocking structural diagnostic.
- **Completion:** IO boundary exists and blocking diagnostics are resolved.
- **Recovery:** direct repair, undo, replace, or delete in the stable inspector.
- **Does not belong:** manual rail toggles, Compare controls, irrelevant mapping lessons for internal gates.

At constrained widths the library remains available and selected details move to a stable lower region automatically. The student never manages the basic page layout.

The enforced laptop conformance floor gives the canvas at least `62%` of the full laptop viewport. The strategic target remains `70%`. Current full-viewport share is `63.1%` at `1366x768` and `65.0%` at `1440x900`; the corresponding available-workbench shares are `64.81%` and `66.67%`. At `1920x1080`, available-workbench share is `75.16%`. The laptop target is therefore explicit remaining debt, not a satisfied acceptance claim.

### Verify / Simulation Studio

- **Primary object:** authored testbench and its simulation evidence.
- **Stable regions:** testbench tabs/editor, one run command bar, waveform/results.
- **Primary action:** Run Observe, Run Compare, Update Compare, or Rerun according to state.
- **Secondary actions:** repair expected output or inspect/fix circuit.
- **Empty state:** visible quiet waveform plus direct first-testbench guidance.
- **Blocked state:** no runnable cases, incomplete checks, disconnected output, stale evidence, or mismatch.
- **Completion:** current Compare PASS for the saved design and testbench.
- **Recovery:** explicit testbench repair or Design handoff.
- **Does not belong:** mapping controls, competing run authorities, nested essential disclosures, detached status clouds.

Combinational testbenches use one row per case with visible input, expected, observed, status, and row actions. Sequential circuits use a horizontal timeline with clock/reset/stimulus/expected lanes, run length, clock policy, sample points, and waveform evidence.

### Map Pins

- **Primary object:** grouped pin-mapping table.
- **Stable regions:** progress header, mapping table, selected-signal editor, secondary board reference.
- **Primary action:** assign/change selected signal.
- **Secondary actions:** clear assignment or open Design for IO repair.
- **Empty state:** explain the missing Design signal boundary without an error wall.
- **Blocked state:** missing, invalid, or conflicting required mapping.
- **Completion:** every required signal has one coherent resource/package-pin assignment.
- **Recovery:** inline conflict actions beside affected rows.
- **Does not belong:** Verify repair, after-mapping disclosures, dominant board art, hidden diagnostic panels.

### Export

- **Primary object:** current handoff package decision and contents.
- **Stable regions:** blocked/draft/ready decision, package file list, selected-file preview, submission guidance.
- **Primary action:** repair the owning stage, build package, or download current package according to state.
- **Secondary actions:** policy-permitted draft download; Technical evidence dialog.
- **Empty state:** exact prerequisite plus one owner-stage repair action.
- **Blocked state:** real Design/mapping/artifact prerequisite prevents a usable package.
- **Completion:** current Browser-E0 package is inspectable and downloadable.
- **Recovery:** route to Design, Verify, or Map Pins, then rebuild.
- **Does not belong:** pin editors, dominant proof-debug panels, repeated E0 labels, core files hidden in accordions.

### Import / Recovery

- **Primary object:** reviewed import candidate.
- **Stable regions:** horizontal `Upload -> Review -> Apply` stepper, active workspace, safety boundary.
- **Primary action:** choose source, review candidate, or confirm replacement according to step.
- **Secondary actions:** Paste HDL, structural sample, Cancel and keep current work.
- **Empty state:** one ZIP chooser with secondary reconstruction paths.
- **Blocked state:** invalid source, parse failure, unresolved ports, or incomplete review.
- **Completion:** candidate is explicitly applied or safely cancelled.
- **Recovery:** durable correction action with no current-work mutation.
- **Does not belong:** internal vertical workflow rail, competing source-mode navigation, apply-before-review, workflow-stage progress.

## Semantic status rule

Pills are reserved for a small set of semantic states such as PASS, FAIL, stale, blocked, attention, complete, draft, and Browser-E0 ready. Ordinary facts are headings, labels, table values, rows, or sentences.

## Human usability lab

Visible-product trials were run without source, test IDs, runtime objects, or implementation documents:

1. **Student A — complete:** Half Adder from scratch through four-case Compare PASS, mapping, rerun, and a nine-file Browser-E0 download in `13m33s`; about `80` pointer/select actions, one backtrack, zero definite misclicks, and no irreversible state loss.
2. **Student B — complete:** modified two-bit counter with a named custom sequential timeline, Observe/rerun waveform review, and nine-file draft download in `9m14s`; about `33` clicks, two text edits, two scroll attempts, two retries, zero definite misclicks, and no irreversible state loss. Observe-only evidence was not promoted to Compare proof.
3. **Student C — partial:** invalid-HDL recovery, valid structural review, three mappings, cancel preservation, re-review, and native replacement confirmation were exercised in about nine minutes. The browser-control session became unavailable immediately after confirmation, so replacement completion, downstream Verify/Map Pins repair, and Export remain unproven in this blind trial.
4. **Broken XOR — automated only:** failure diagnosis and repair are covered by browser automation, but no source-blind elapsed time, click count, or confusion record exists.

The usability lab is therefore partial even though the rebuilt automated product gates are green.

## Acceptance

The tracked gate is `scripts/gates/ide-unified-workbench-v3-flow.mjs`, registered as `ide:gate:unified-workbench-v3-flow`, and covers `1366x768`, `1440x900`, `1920x1080`, and a 125%-equivalent viewport.

Acceptance requires:

- no permanent workflow side rail
- no core `<details>` / `<summary>` workflow
- no rail Hide/Show controls or floating edge toggles
- one primary action per state
- stable shared page grammar
- no root overflow, internal clipping of required work/actions, or browser errors
- required action centers are pointer-hittable and keyboard reachable
- exactly one `main` landmark and an accessible name for the primary circuit canvas
- simulation results are announced and focus remains deliberate after a run
- usable Project overview and alternatives
- stable Design library/canvas/inspector with camera and editing proof
- combinational and sequential Verify authoring with PASS/stale/FAIL repair
- table-first Map Pins conflict repair
- stable Export decision/file preview
- Import Upload/Review/Apply with cancel and invalid-input preservation
- standalone `ide:gate:sequential-testbench-authority` and standalone `ide:gate:mapping-preview-package-agreement`; neither is replaced by the 72-step aggregate
- focused tests/gates, full `classroom:gate`, docs, encoding, and diff proof under Node `20.19.0`

## Historical local closeout (2026-07-18)

**Verdict:** Major phase completed locally; usability lab partial.

The 13 foundational reconstruction commits end at `fa9fa366e`. Final professor/QA repair and proof commits continue through `d82c379eb0f15491a6077ad034e72c81f6758891`, producing 15 v3 commits before documentation closeout; the documentation closeout is the 16th v3 commit.

The initial professor **NO-GO** and QA **HOLD** identified real defects. Fresh rebuilt-bundle independent replay closes the concrete overlap, clipping, hitability, landmark, canvas-name, and result-announcement findings. The original reviewers were not rerun, so this is not professor approval or QA re-approval.

Remaining debt is explicit: the strategic 70% laptop Design target is unmet, Student C is partial, and Broken XOR has automated proof only. This is local Browser-E0 evidence only: no push, deploy, production, Vivado, Basys3, or E1/E2/E3 proof applies.

The later RC addendum supersedes that next step: freeze the approved docs-complete source, reconstruct a curated non-main release branch, and certify one exact SHA before any remote release claim. Guided 4-Bit Adder, Hardware Mapping Assistant v2, and Vivado E1 remain separate later lanes.

## Attribution

Connor Angiel
