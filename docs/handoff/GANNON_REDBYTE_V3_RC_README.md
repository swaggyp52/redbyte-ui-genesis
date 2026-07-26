---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: Gannon Unified Workbench v3 release-candidate handoff
---

# Gannon RedByte Unified Workbench v3 RC Handoff

## Status

This is a **release-candidate source handoff**, not a released, production, Vivado-certified, or board-certified build.

| Item | Current truth |
|------|---------------|
| Reviewed RC source identity | **RESULT-DEPENDENT** — read it from the external frozen manifest, build identity, PR head, and check run; do not embed a future-self SHA here |
| Final reconstructed candidate identity | **RESULT-DEPENDENT** — record only after reconstruction and tree-identity proof |
| Exact-tree automated evidence | **RESULT-DEPENDENT** — populate only from the final candidate run |
| Browser proof tier | E0 only |
| Human assignment-trial disposition | **RESULT-DEPENDENT** |
| Final exact-tree automated certification | **RESULT-DEPENDENT** |
| Vivado / bitstream / board claim from this RC | None |

The candidate remains local until the freeze, reconstruction, exact-SHA evidence run, and human release disposition are complete. Do not identify this document, its source commit, or a browser screenshot as proof that a package builds in Vivado, generates a bitstream, programs a board, or behaves correctly on hardware.

## Who this handoff is for

- Gannon students using RedByte to design and verify supported digital-logic projects.
- Instructors and TAs preparing a supervised browser-E0 course workflow.
- Release owners reconstructing and certifying the final candidate.

## Student flow

The RedByte-owned workflow has exactly five numbered stages:

`Project -> Design -> Verify -> Map Pins -> Export`

**Import / Recover** is a separate utility for restoring RedByte work or reviewing HDL/XDC. It is not a sixth progress stage.

1. **Project:** Start or open work, review project identity and goal, see current Design/Verify/Map Pins/Export truth, and follow one recommended next action.
2. **Design:** Build the supported circuit on the dominant grid. Place components, connect explicit port targets, inspect issues, and repair structural blockers.
3. **Verify:** Create or choose a named testbench document, author stimulus and expected checks, configure its sequential execution policy when needed, then Observe or Compare. Treat stale or historical runs as non-current evidence.
4. **Map Pins:** Select each logical signal, choose a compatible Basys3 resource in the selected-signal editor, and save the assignment. Use the board graphic as a reference only.
5. **Export:** Read **What should I submit?**, distinguish trusted/current from draft, inspect generated files, and download only the package kind allowed by the assignment.
6. **Import / Recover:** Prefer a RedByte ZIP for lossless restore. Review fidelity and replacement consequences before Apply; Cancel preserves current work.

## Candidate authority contracts

| Area | Candidate authority |
|------|---------------------|
| Project overview | Loaded projects show identity, summary/goal, professional facts, current stage truth, and one recommended next action. |
| Design workspace | Circuit grid is primary. Sparse port targets are at least 24×24px; dense targets are at least 32×24px, with current dense targets 32×36px. Wiring is keyboard reachable. |
| Verify documents | Document identity, cases, stimulus, expected checks, sequential steps, and sequential policy remain attached to the named browser-local document through save/reload/duplicate/rename and compatible repair. |
| Sequential policy | Execution override, run cycles, active edge, reset behavior, source type, execution model, resolved clock/control identity, and starting level belong to the active document. The policy remains outside portable `RBProject`. |
| Sequential execution | Manual/custom rows drive the authored clock and settle once. Only low-to-high advances rising-edge state; repeated high, falling, repeated low, and flat-low hold it. Auto materializes cycle 0 and the selected run cycles; every Auto report row and VHDL assertion is post-rising-edge. Auto reset, when selected, is explicit in materialized cycle 0 and later deassertion—not a hidden runtime prelude. Manual/custom mode also injects no hidden reset. |
| Verify evidence | `current`, `missing`, `stale`, and `failed` evidence currentness remain distinct. A truth-affecting Design or scenario-policy change revokes current Compare/waveform authority. Layout-only movement does not. Observe-only and failed evidence never support trusted Export classification. |
| Waveform usability | Post-run lanes use 36×36px interaction targets and labels remain at least 13px. |
| Mapping projection | Logical signal ID/label, direction, artifact port, board resource ID/label, package pin, I/O standard, exact XDC line, required state, and conflict state form one coherent projection. |
| Export trust | Structural `blocked` / `downloadable`, `verificationTrust` `unverified` / `draft` / `trusted`, and action `not-downloaded` / `downloaded` are separate. Verify evidence currentness is upstream and is not an Export enum. |
| Sequential package authority | Runtime Verify, bring-up expectations, and `testbench.vhd` consume the same materialized execution vectors plus the resolved clock/schedule projection. Auto `runCycles` and automatic reset behavior can change those vectors and package bytes. Auto VHDL uses a free-running generator and samples/asserts each materialized row post-rising-edge; manual/custom assigns authored clock values and settles without that scaffold. |
| Package receipt | The current receipt binds source fingerprint, project/Verify hashes, mapping currentness, download kind, trust state, and SHA-256 to the exact downloaded package. |
| Package manifest | The embedded `project.rbproj.json` is generated with the package and contains the exact generated `top.vhd` and `top.xdc` projection. |
| Import recovery | A valid embedded RedByte manifest is authoritative; loose sibling HDL/XDC cannot override it. Scalar/vector-bit identities such as `SW[1]` and `LED[1]` remain exact. |
| HDL reconstruction | The supported RedByte-generated concurrent-assignment subset reconstructs its supported graph. Arbitrary behavioral/process HDL remains partial or blocked; the manifest is required for lossless RedByte metadata. |

Named Verify documents and their sequential policies are browser-local workspace sidecar state. This candidate does not claim that a new portable `RBProject` field transfers them between browsers or arbitrary archives.

That storage boundary does not make the policy package-neutral. The materialized execution vectors and resolved clock/schedule projection are byte-bearing inputs to generated `testbench.vhd`, package fingerprinting, Export freshness, and receipt authority.

## Design geometry and known debt

| Viewport | Circuit-grid occupancy | Disposition |
|----------|------------------------|-------------|
| 1366px laptop | 63.1% | Meets the 62% RC release floor |
| 1440px laptop | 65.0% | Meets the 62% RC release floor |
| Strategic laptop target | 70% | Unmet; remains recorded product debt |

The side regions are intentionally constrained so the circuit grid remains the main work object. Meeting the RC floor does not erase the 70% target.

## What a student should submit

The assignment or LMS instruction remains authoritative. In RedByte:

- Use **Download Package** only when Export identifies a trusted/current handoff.
- Use **Download draft** only when the course explicitly accepts an untrusted but structurally buildable package.
- Check that the receipt describes the exact downloaded package.
- Do not infer Vivado or board success from the browser package alone.

## Import recovery expectations

- A RedByte ZIP with a valid `project.rbproj.json` is the lossless recovery path.
- The embedded manifest must agree with the generated `top.vhd` and `top.xdc` in the same package.
- Loose sibling files cannot silently replace manifest authority.
- Supported RedByte-generated `top.vhd` can reconstruct the supported graph without its manifest, but layout, named Verify documents, mapping, and other RedByte metadata are not losslessly recovered that way.
- A failed or canceled import leaves the active project unchanged.

## Candidate evidence ledger

The exact candidate acceptance program must invoke these commands separately:

```powershell
corepack pnpm -s ide:gate:sequential-testbench-authority
corepack pnpm -s ide:gate:mapping-preview-package-agreement
```

They are required outside the uninterrupted 72-step `classroom:gate`; the aggregate does not substitute for either standalone authority gate.

| Evidence | Result | Boundary |
|----------|--------|----------|
| Final exact-tree integrated matrix | **RESULT-DEPENDENT** | Record only from the reconstructed candidate; do not reuse an earlier source-slice result |
| Sequential policy persistence | **RESULT-DEPENDENT** | Browser-local document lifecycle; no portable `RBProject` field claim |
| Sequential runtime execution | **RESULT-DEPENDENT** | Manual/custom authored-clock, rising-edge-only, flat/falling hold, and report/waveform/check agreement |
| Sequential generated-testbench/package parity | **RESULT-DEPENDENT** | E0 byte/freshness authority only; no Vivado execution claim |
| Mapping preview/package agreement | **RESULT-DEPENDENT** | E0 Map Pins, XDC, package, manifest, and manifest-first recovery agreement |
| Host ZIP byte inspection | **RESULT-DEPENDENT** | Deterministic archive inspection is required; an in-app download record alone is insufficient |
| Design/Verify interaction proof | **RESULT-DEPENDENT** | Interaction geometry and browser usability do not substitute for simulator authority |
| Export submission-answer contract | **RESULT-DEPENDENT** | Browser action/trust language only |
| ZIP Import recovery contract | **RESULT-DEPENDENT** | Browser recovery/identity only |

## Excluded from this candidate

- Guided 4-bit experience.
- Mapping Assistant v2.
- Any new Vivado E1 certification.
- Bitstream generation or board programming evidence (E2).
- Physical board observation evidence (E3).
- A claim that arbitrary HDL reconstructs into an editable RedByte schematic.
- A claim that the strategic 70% Design laptop-occupancy target has been met.

## Release-owner completion checklist

1. Freeze the reviewed docs-complete RC source tree and record it in the external frozen manifest; do not hard-code an earlier product-only SHA as reconstruction input.
2. Reconstruct a clean candidate from the intended branch/commits without carrying unrelated worktree state.
3. Record the exact reconstructed candidate SHA, branch, remote delta, Node version, pnpm version, and clean status.
4. Run the required automated matrix against that exact SHA and preserve exact pass/fail counts.
5. Run standalone `ide:gate:sequential-testbench-authority` and standalone `ide:gate:mapping-preview-package-agreement`, then run the uninterrupted 72-step `classroom:gate`; do not treat the aggregate as a substitute for either standalone gate.
6. Run `pnpm -s rb:doc:validate` and `pnpm -s rb:encoding:check` against that exact SHA.
7. Regenerate `docs/manuals/RedByte_Product_Manual.pdf` from the updated print HTML and visually inspect every page.
8. Run `docs/release/manual-assignment-qa-script.md` at the required laptop viewports and record every phase verdict.
9. Reconcile all findings into an explicit release disposition. A partial or failed trial remains partial or failed.
10. Only then create the approved non-main remote release boundary. Do not push directly to `main` from this handoff.

## Canonical companion documents

- `AI_STATE.md`
- `docs/ACTIVE_WORK.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/product/RED_BYTE_UNIFIED_WORKBENCH_V3.md`
- `docs/IDE_SYSTEM_MAP.md`
- `docs/ide/SURFACE_CONFORMANCE.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/manuals/MANUAL_CLAIM_AUDIT.md`
- `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md`
- `docs/manuals/MANUAL_CONFORMANCE.md`
- `docs/STUDENT_RELEASE_READINESS.md`
- `docs/release/manual-assignment-qa-script.md`

## Attribution

Connor Angiel
