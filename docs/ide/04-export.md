---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Export surface spec
---

# Export Mode Spec

Status: Unified Workbench v3 RC trust source; final exact-SHA certification pending
Mode ID: `export`

## Purpose

Act as the compiler-like Export handoff station for Basys3 Vivado artifacts while distinguishing draft artifacts from trusted verified E0 handoff.

## Primary Actions (max 3)

1. Understand the current readiness/trust state and take its direct repair action when blocked.
2. Build or download the deterministic browser-E0 package when ready.
3. Open `Inspect generated files` to browse, preview, and copy generated artifacts.

## Layout

1. Top handoff station
- Exactly one visible Export handoff station owns Draft / Needs Review, Ready to Build, and Trusted package state.
- The station shows the consequence sentence and one state-appropriate repair/build/download action before artifact detail.
- The first viewport answers **What should I submit?**: submit only the roles requested by the instructor/LMS, commonly `top.vhd` and `top.xdc`, adding `testbench.vhd` only when simulation evidence is requested. RedByte must not invent a universal course submission policy.
- Trusted post-download state stays download-oriented; it must not make hardware programming the primary Export action.
- Compact package-content and E0-boundary copy identifies the browser handoff while keeping Vivado build, bitstream, and board observation external.
- `Readiness details` discloses whether Verify evidence is current/stale/failed, whether pin mapping is current/missing, whether the browser-E0 package is trusted or draft, and that Vivado build and board behavior are not proven inside RedByte.

2. Main center
- `Inspect generated files` is an explicit disclosure beneath readiness. Opening it reveals the artifact browser and selected preview for files such as `README.txt`, `top.vhd`, `top.xdc`, and `testbench.vhd`.
- Direct preview and copy controls operate only after generated-file inspection is opened; the file workspace must not outrank the readiness decision.
- Submission guidance and compact Vivado evidence diagnostics separate E0 package generation, E1 Vivado build/bitstream, E2 board programming, and E3 observed behavior.

3. Right inspector
- Pin table.
- Validation and warning list.
- Artifact checklist, build/debug context, hashes, and proof metadata remain collapsed support detail by default.
- Mapping rows are read-only and display board labels before package pins, for example `SW0 (pin V17)`, while generated constraints still use the resolved package pin.

## Empty State

Headline: `No handoff package yet`
Primary CTA: the blocker owner's direct action, such as `Open Design`, `Open Simulate`, or `Open Board & Constraints`
Secondary disclosure: `Readiness details`

## Error State

Hard block export when:

1. Missing IO mapping.
2. Unsupported nodes for synthesis.
3. Missing top-level constraints.
4. Imported sim-only `Clock` components are present in a board-ready package path.

Each error must include a direct fix path.

## Success State

`Export Ready` / trusted handoff with:

1. Artifact count.
2. Deterministic export hash.
3. Current Compare PASS with saved checks.
4. Download actions enabled.

Structurally valid packages may still be downloaded as draft Vivado packages, but the UI must not call them trusted until Verify passes and the package is current.

## Structural, trust, and action axes

Export state is not one boolean:

1. **Structural:** `blocked` or `downloadable`, derived from compiler/mapping prerequisites.
2. **Verification trust:** `unverified`, `draft`, or `trusted`.
3. **Action:** `not-downloaded` or `downloaded`, derived from a receipt for the exact current package.

Verify evidence currentness is a separate upstream classification: `current`, `missing`, `stale`, or `failed`. Observe-only traces never count as Compare proof. These labels must not be substituted for the Export `verificationTrust` enum.

A receipt is current only when all of the following agree: download kind, package-source fingerprint, current project hash, current Verify hash (when present), current verification-trust classification, project/export/mapping currentness, and a valid SHA-256 package hash. Editing any byte-bearing artifact input or wrapper input revokes the action claim for the new package. A downloaded unverified/draft package remains unverified/draft; action does not promote trust.

`buildProjectExportPackageSourceHash()` fingerprints the ordered artifact paths/content plus the Vivado wrapper inputs that affect project ZIP bytes. This makes `Downloaded trusted` an exact-package statement rather than a sticky UI success state.

## Mapping and manifest agreement

The same semantic mapping projection that Board & Constraints renders is consumed by the generated `top.xdc`, README, EXPECTED_IO, Export rows, and the embedded `project.rbproj.json`. The manifest projection refreshes generated `top.vhd` and `top.xdc` to the exact packaged content before encoding. Sibling files are transport copies; the manifest is the round-trip authority.

Keep identity domains explicit:

- logical signal: e.g. `EN`
- artifact port: e.g. `SW`
- board resource: e.g. `SW0`
- package pin: e.g. `V17`

These may correctly form one trace (`EN -> SW -> SW0 -> V17`) without being the same name or count.

`Ready to Build` means RedByte has current browser-side prerequisites for an E0 package but has not yet produced the current bundle in the session. `Trusted` means the current Compare PASS, mapping, and current package agreement are present. In both states the primary station action remains build/download.

Export must also keep downstream Vivado/bench evidence separated:

1. **E0** - RedByte generated the Vivado package artifacts.
2. **E1** - Vivado synthesis, implementation, and bitstream evidence exists outside RedByte.
3. **E2** - Board programming evidence exists outside RedByte.
4. **E3** - Physical board behavior was observed and recorded.

E2 programming success must never imply E3 behavior proof. When no bench classifier output is attached to the browser session, Export should say so plainly and keep E1/E2/E3 as external/manual evidence.

For pilot labs, Export must state that the RedByte/Vivado ZIP proves browser-E0 package generation only. It must not imply that ZIP submission proves Vivado build success, bitstream generation, programming success, or physical board behavior.

`ide:gate:blank-adder-authoring-depth` guards the from-scratch 4-bit adder E0 package path: Hardware mapping must agree with Export, opening generated-file inspection must expose `README.txt`, `top.vhd`, `top.xdc`, and `testbench.vhd`, the downloaded ZIP must contain the expected package files, and README copy must preserve the E0-only boundary.

`ide:gate:testbench-editor-and-export-confidence-flow` guards the Simulate-to-Export confidence path: stale Simulate/testbench evidence must show Draft/not-trusted export confidence, current Compare PASS plus current mapping must show current browser-E0 confidence, and Vivado build / board observation must remain external rather than being claimed by the browser.

`ide:gate:mapping-preview-package-agreement` is the exact required standalone mapping/package authority gate. It compares the Board & Constraints projection, exact XDC preview, generated package content, canonical manifest HDL/XDC, and manifest-first Import. Run it separately from the uninterrupted 72-step `classroom:gate`; the aggregate does not substitute for this gate.

`ide:gate:export-submission-answer-contract` is the required first-viewport submission gate at `1366x768`, `1440x900`, and `1920x1080`.

Current integrated pre-doc source `0788044cb` passes the touched authority matrix (`20/20` files, `258/258` tests), typecheck, unified build, mapping/package agreement, custom-clock ZIP truth, and Export-trust integrity under pinned Node `20.19.0` / pnpm `10.24.0`. Historical `f4f7ca8f3` passed the earlier `36/36`, `477/477` matrix before the final sequential repair. Neither checkpoint certifies the later docs-complete reconstructed release SHA; exact-SHA gates, classroom aggregate, human review, and remote checks remain pending.

Verify freshness is based on the normalized Verify evidence signature shared with workflow authority. Helper-generated clock/testbench vector IDs do not make a passing run stale; actual stimulus, circuit, or mapping changes do.
When Verify evidence is stale, Export copy should name the real drift source at the student level: **design, testbench, or mapping changed since the last Compare run**. The repair path is **Open Verify**, not a generic refresh label.

## Sequential testbench projection

Export consumes the shared materialized execution vectors plus the resolved clock/schedule projection. It must not use UI status, waveform, or Compare-result objects as generated-testbench inputs.

- **Auto board clock:** materializes cycle 0 and the selected `runCycles`, including automatic reset assertion/deassertion in those vectors when applicable. Generated `testbench.vhd` includes the free-running clock process and `CLK_HALF_PERIOD`, then waits for a rising edge before every materialized row assertion. Each Auto report row and VHDL assertion therefore describes the same post-rising-edge sample.
- **Manual/custom:** generated `testbench.vhd` omits the free-running generator and rising-edge-wait scaffold, assigns the resolved clock from each materialized authored vector, and samples after the deterministic settle interval.

Auto `runCycles`, automatic reset behavior, resolved clock/schedule data, starting level, and authored stimulus may change the shared materialized vectors, `testbench.vhd`, and package bytes, so Export becomes stale and an old receipt no longer describes the current package. Automatic reset is part of the materialized sequence, not a hidden runtime-only prelude. Browser-local storage and package-byte authority are separate questions: the policy stays outside portable `RBProject`, while materialized vectors and the resolved projection remain byte-bearing Export inputs. The current repo only ships the VHDL testbench generation path; there is no separate Verilog testbench generator to update in this slice.

Imported `config.role === "sim"` Clock components are import-only. Export must block them with copy that tells students to replace the component with the `CLK100MHZ` Board Resource before trusting auto Verify or Export; it must not tell students to add a generic `Clock` node for Basys3 work.

## Batch 1 Product Audit Notes (2026-04-30)

- Supposed to do: generate real Vivado artifacts while making draft vs trusted handoff impossible to confuse.
- Current truth: custom mixed-gate and two-bit-counter rows build through real Vivado E1 with `top.vhd`, `top.xdc`, `.xpr`, Tcl, README/bring-up, and proof metadata preserved by the harness.
- Determinism change needed: keep paths short enough for Windows/Vivado certification output, and make official Vivado/XDC references visible in docs when they define product truth.
- Friction found: a dated long case ID (`fs-custom-mixed-gate-chain-2026-04-30`) failed in Vivado synthesis because the generated run path exceeded practical Windows/Vivado RTD path limits. Short case IDs (`b1-mixed`, `b1-counter`) passed E1.

## Data Contract (RBProject)

Reads:

1. `hdl`
2. `fpga`
3. `ioMapping`
4. `meta`
5. `circuit`

Writes (guarded):

1. `hdl`
2. `fpga`
3. `ioMapping`
4. `meta`
