# RedByte Product Manual — Conformance Governance

**Document:** RB-CONF-001 v1.0
**Date:** 2026-03-31
**Applies to:** `docs/manuals/RedByte_Product_Manual.md` and `docs/manuals/RedByte_Product_Manual_print.html`

---

## Purpose

This document defines the rules that keep the product manual accurate as the codebase evolves. It establishes:

1. Which source files are authoritative for each class of manual claim.
2. Which sections of the manual must be reviewed when specific source files change.
3. The process for updating the manual on each type of change.
4. The audit cadence.

---

## Authoritative Source Map

The following table is the canonical mapping between codebase artifacts and the manual sections they govern. When a source file changes, all corresponding manual sections must be reviewed.

| Source File | Governs Manual Section(s) | Critical Claims |
|-------------|--------------------------|-----------------|
| `packages/rb-logic-core/src/builtins.ts` | §2.3, §7.2, Appendix A | Registered primitives, port names, gate behaviors |
| `packages/rb-logic-core/src/index.ts` | §7.2, Appendix A | Total primitive count, registry |
| `packages/rb-apps/src/apps/ide/workflowStages.ts` | §4.1, §6, §7 | Surface names, IdeMode values |
| `packages/rb-apps/src/apps/ide/verifyHints.ts` | §7.3, §9 | Hint count (currently 14), hint conditions |
| `packages/rb-apps/src/apps/ide/projectRuntime.ts` | §7.3 | Freshness / staleness triggers |
| `packages/rb-apps/src/apps/ide/examplesCatalog.ts` | §5.3 | Starter example names and IDs |
| `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | §7.4, §10 | Hardware tab labels, sim status strings |
| `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | §7.6, §12 | Import tab labels, fidelity UI strings |
| `packages/rb-apps/src/apps/IdeApp.tsx` | §3.4, §4.7 | Application contexts, IdeImportFidelity enum |
| `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` | §10, §11, §14, Appendix B, C | XDC filename, entity name, pin definitions, LVCMOS33 |
| `packages/rb-apps/src/fpga/boards/basys3/testbenchGenerator.ts` | §11.4, Appendix C | Testbench entity name (`tb_top`) |
| `packages/rb-apps/src/fpga/vivado/vivadoProjectFolder.ts` | §11.2, §14.2 | ZIP file contents, testbench top module |
| `packages/rb-apps/src/import/hdlToCircuit.ts` | §4.7, §12, Appendix E | COMPONENT_MAP size, internal fidelity levels |
| `packages/rb-apps/src/export/submissionBundle.ts` | §13, §14 | SHA-256 hashing, manifest structure |
| `packages/rb-apps/src/apps/ide/components/IdeLeftRail.tsx` | §6 | Left rail entries, navigation order |
| `docs/ARCHITECTURE.md` | §3.4, §4.4 | Five-layer architecture, application contexts |
| `docs/STUDENT_UX_LAYER.md` | §3.1, §3.2, §7 | UX constraints, diagnostic visibility rules |
| `docs/VIVADO_INTEGRATION.md` | §11 | Vivado workflow, generated file purposes |

---

## Change Impact Matrix

When a PR touches any of these file patterns, the manual must be reviewed for the indicated sections:

| Changed File Pattern | Must Review | Likely Change Type |
|---------------------|-------------|-------------------|
| `**/builtins.ts` | §7.2, Appendix A | New/removed primitive |
| `**/workflowStages.ts` | §4.1, §6 | New surface or renamed mode |
| `**/verifyHints.ts` | §9 | Hint count change |
| `**/basys3Bundle.ts` | §10, §11, Appendix B/C | Pin change, filename change |
| `**/testbenchGenerator.ts` | §11.4, Appendix C | Testbench structure change |
| `**/vivadoProjectFolder.ts` | §11.2, §14.2 | ZIP content change |
| `**/hdlToCircuit.ts` | §12, Appendix E | Import behavior change |
| `**/submissionBundle.ts` | §13 | Submission format change |
| `**/ImportSurface.tsx` | §7.6, §12 | UI label change |
| `**/HardwareSurface.tsx` | §7.4, §10 | UI label/tab change |
| `**/IdeApp.tsx` | §3.4 | Context or enum change |
| `docs/ARCHITECTURE.md` | §3.4, §4.4 | Architecture change |

---

## Update Process

### For any code change that touches a file in the Authoritative Source Map:

1. **Identify impact.** Use the Change Impact Matrix to determine which manual sections are affected.
2. **Review sections.** Open `RedByte_Product_Manual.md` and read all affected sections against the new code.
3. **Apply corrections.** Edit both `RedByte_Product_Manual.md` and `RedByte_Product_Manual_print.html` to match the new ground truth.
4. **Record the correction.** Add a row to `MANUAL_CLAIM_AUDIT.md` under a new "Change Log" section with: date, changed source file, old claim, new claim, section updated.
5. **Regenerate PDF.** Run `pnpm docs:manual:pdf` to regenerate `RedByte_Product_Manual.pdf`.
6. **Update traceability.** If a new claim was added, add a row to `MANUAL_TRACEABILITY_MATRIX.md`.

### For new features:

1. **Draft new section.** Add documentation to the manual covering the new feature.
2. **Add traceability rows.** Every new claim must have a corresponding row in `MANUAL_TRACEABILITY_MATRIX.md` with the source file and line numbers.
3. **Run audit pass.** Verify new claims against the code before merging.

---

## Audit Cadence

| Trigger | Action |
|---------|--------|
| Any PR that touches a file in the Source Map | Targeted review of affected sections (see Update Process) |
| Major version release | Full audit pass — re-verify all rows in the Traceability Matrix |
| Quarterly (or every 3 sprints) | Spot audit — randomly sample 10 claims and verify against code |
| New engineer onboarding | Full manual read to ensure understanding of documented behaviors |

---

## Invariants (Never-Change Claims)

These claims have been stable since the first version and should only change if the corresponding architectural decision is explicitly reversed:

1. **Connection format is nested** — `{ from: { nodeId, portName }, to: { nodeId, portName } }`. Enforced by `normalizePortRef`. Never use flat format.
2. **Simulation is deterministic** — same state + same inputs = same outputs, every run, every machine.
3. **Local-first** — all computation in browser. No server dependency for core functions.
4. **One truth, many views** — circuit is the single source; all surfaces are projections.
5. **LVCMOS33 I/O standard** for all Basys 3 ports.
6. **Top entity name is `top`** — default entity name; overridable but `top` is the canonical default.
7. **Testbench entity pattern is `tb_<topModule>`** — currently `tb_top`.

---

## Prohibited Manual Claims

The following categories of claim are prohibited in the manual because they cannot be verified from code:

- Claims about runtime performance (latency, throughput) unless benchmarked and cited.
- Claims about browser compatibility beyond "any modern browser with JavaScript."
- Claims that NOR and XNOR are available in the component palette (they are type-defined but not registered).
- Claims about VHDL reserved-word keyword validation (not implemented).
- Claims that SubmissionInspectorApp is a separate launchable application (it is an architectural context, inspector delivered via Project surface).
- Claims about the number of hint conditions unless `verifyHints.ts` is re-audited.

---

## Contacts

| Role | Responsibility |
|------|---------------|
| Manual owner | Connor Angiel — approves all manual changes |
| Code reviewer | Any PR reviewer touching Source Map files must check manual impact |

---

*End of Conformance Governance*
