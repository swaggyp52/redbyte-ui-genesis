# RedByte Gap Audit

**Status:** Complete (v1)
**Date:** 2026-04-01
**Owner:** Claude / Connor
**Purpose:** Brutally honest audit of the gap between RedByte's current product reality and the target product standard.

---

## 1. Executive Summary

### Overall judgment

RedByte is a **substantially implemented FPGA educational IDE** with a sound architecture (5-layer A-E model), a working student path (Design → Verify → Export → Vivado), and strong internal contracts (deterministic simulation, structured connection format, single-codepath HDL generation).

The core engine and pipeline are legitimate. The documentation system (manual + audit + traceability) is more rigorous than most projects this size. The IDE-era spec documents under `docs/ide/` are current-truth and enforced.

But: the repo's front door lies about the product (README claims 3D editing, time-travel debugging, OS-era branding). The manual overclaims features that don't exist (Export Grading Report, verification replay, FPGA Bridge). Design-time feedback for critical circuit errors is missing. The sequential path has unsupported boundaries that are detected but not blocked. And the documentation does not separate current-state truth from target-state contract.

- [x] product-legit in its core student workflow
- [ ] classroom-trustworthy (two pre-lab blockers remain)
- [ ] manual/screenshot-worthy (trust and visual gaps remain)
- [ ] visually credible as a real tool (not assessed in this audit — runtime inspection needed)
- [ ] internally coherent across workflow, terminology, and generated outputs (README/manual/obsidian disagree)

### Primary blockers
1. README lies about the product — every visitor sees OS-era claims
2. Manual overclaims features that don't exist
3. Sequential path boundaries detected but not blocked (falling-edge, multi-clock, active-low reset)

### Immediate recommendation
Fix the README and remove manual overclaims (P0 truth fixes). These are the highest-leverage, lowest-risk changes. They can be done in a single batch and immediately improve credibility for anyone reading the repo or the manual.

---

## 2. Audit Method

### Sources reviewed
- Canon docs: `CLAUDE.md`, `README.md`, `docs/DOC_INDEX.md`, `docs/manuals/RedByte_Product_Manual.md`, `docs/manuals/MANUAL_CLAIM_AUDIT.md`, `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md`, `docs/manuals/MANUAL_CONFORMANCE.md`
- Obsidian canon: `08 Agents + Prompts/Canonical Notes Policy.md`, `08 Agents + Prompts/Claude Session Mode.md`, `08 Agents + Prompts/Post Run Extraction.md`, `03 Architecture/Note Schema.md`, `01 Dashboard/RedByte Engineering Brain.md`
- Architecture / product docs: `ARCHITECTURE.md`, `STUDENT_UX_LAYER.md`, `VIVADO_INTEGRATION.md`, `PRODUCT_SURFACES.md`, `INTERACTION_CONTRACT.md`, `PROJECT_MODEL.md`, `RB_FPGA_MVP_SPEC.md`, `ERROR_MESSAGE_MATRIX.md`, `TROUBLESHOOTING_MATRIX.md`, all 9 `docs/ide/` files, all 5 `docs/00-canon/` files
- Implementation areas inspected: All 6 surfaces (ProjectSurface, DesignSurface, VerifySurface, HardwareSurface, ExportSurface, ImportSurface), clock handling pipeline (verifySchedule.ts, simClockInjection.ts, vectorRunner.ts, IdeApp.tsx, basys3ExportService.ts, basys3Bundle.ts), palette and component registry
- Tests / gates: Test baseline from Engineering Brain (168 pure-logic + 52 render = 220 green)
- Runtime behaviors manually validated: Not validated in this audit (code inspection only)

### Evidence standard
Claims in this audit are based on:
- [x] code inspection
- [x] existing repo docs
- [x] cross-document consistency analysis
- [ ] test evidence (relied on existing baseline, did not re-run)
- [ ] generated artifact inspection (relied on export code analysis)
- [ ] runtime manual validation (not performed — needed for visual/UX assessment)

---

## 3. Product Reality Snapshot

### What RedByte already does well
- 5-layer architecture is real, enforced, and documented
- Six surfaces all implemented with meaningful functionality
- Export pipeline produces valid Vivado Kit ZIPs with cross-artifact consistency checks
- Sequential/clocked path has a clear 6-file pipeline with clock detection, injection, and constraint generation
- Product manual suite (manual + audit + traceability + conformance) is internally consistent
- IDE-era docs are current-truth and enforced
- Design system contract is frozen
- 220 tests green

### What RedByte currently pretends to do better than it actually does
- README claims 3D editing, time-travel debugging, automatic bug localization — none exist
- Manual documents Export Grading Report, verification replay, FPGA Bridge as shipped features — no code evidence
- Manual lists LabWorkspaceApp and LogicPlaygroundApp as application contexts — no evidence they function independently
- DOC_INDEX references OS-era architecture concepts as current

### What is functional but not yet legitimate
- Sequential path: rising-edge works, but falling-edge/multi-clock/active-low reset are detected and flagged without blocking — students can get wrong results
- Design-time feedback: circuit errors (driver conflicts, combinational loops, floating drivers) only caught at export
- Export: downloads allowed without verify pass
- Latch execution: uses clocked_macro path — unclear if level-sensitive semantics are correct

### What is actively blocking pride / release / final-manual visuals
1. README is the repo's front door and it lies
2. Manual overclaims 6+ features that don't exist
3. Sequential boundaries let invalid designs through
4. 7+ obsolete spec docs create confusion
5. Obsidian brain has cross-file misalignments
6. Two pre-lab blockers remain (Basys3 rehearsal, clean-tree signoff)

---

## 4. Audit by Major Product Area

### 4.1 Sequential / Clocked Path

**Target standard:** Clock behavior language must be consistent across Design, Verify, Export, and docs. Generated artifacts must reflect what the product claims. User must understand what a clocked verification run actually means.

**Current reality:** Rising-edge single-clock path is substantially implemented and works. Clock detection flows through a clear priority chain. Vector runner has distinct execution protocols per schedule type. Export validates clock contracts. But falling-edge, multi-clock, and active-low reset are detected as temporal issues without being blocked — designs with these proceed silently toward incorrect simulation results and potentially incorrect hardware behavior.

**Evidence:**
- Code: `verifySchedule.ts` (schedule derivation), `vectorRunner.ts` (clocked_macro execution), `simClockInjection.ts` (injection), `basys3ExportService.ts` (clock/reset validation), `basys3Bundle.ts` (XDC constraints)
- Docs: `VIVADO_INTEGRATION.md` (accurate), `SEQUENTIAL_LOGIC_GUIDE.md` (not assessed)

**Gaps:**
- [x] falling-edge detected but not blocked
- [x] multi-clock detected but not blocked
- [x] active-low reset available but no reset-aware simulation
- [x] latch execution path unclear
- [ ] clock language consistency across surfaces (needs runtime inspection)

**Severity:** `high`

### 4.2 Export / Hardware / Vivado Legitimacy

**Target standard:** "Download Vivado Kit" must mean the files work in Vivado without modification. Readiness states must be truthful. Failure recovery paths must exist.

**Current reality:** Export pipeline is sound. Cross-artifact consistency checks exist. Clock constraints are generated correctly. But export is not gated on verify pass. Pin overrides on ExportSurface may conflict with HardwareSurface. Compat fallback testbench is less validated. Verilog path is unmigrated.

**Evidence:**
- Code: `basys3ExportService.ts`, `basys3Bundle.ts`, `ExportSurface.tsx`, `HardwareSurface.tsx`
- Vivado proof: 6-case matrix routed in real Vivado (2026-03-30 per Engineering Brain)

**Gaps:**
- [x] export not gated on verify pass
- [x] pin override reconciliation missing
- [x] fallback testbench less validated
- [x] Verilog path unmigrated
- [ ] failure recovery paths (needs runtime inspection)

**Severity:** `medium` (core path works, gaps are edge cases)

### 4.3 Design Surface Legitimacy

**Target standard:** Schematic editor should feel real. Wire interaction, selection, deletion, undo/redo must be confident. Dense circuits must be editable. Sequential authoring must feel intentional.

**Current reality:** Not assessed in this audit. DesignSurface is ~3000 lines with full palette, grid snap, macro save/instantiate, diagnostic overlay. Code inspection suggests substantial implementation. Runtime visual/interaction assessment needed.

**Evidence:**
- Code: `DesignSurface.tsx` (~3000 lines), palette registry

**Gaps:**
- [ ] wire interaction (needs runtime)
- [ ] selection/deletion confidence (needs runtime)
- [ ] undo/redo confidence (needs runtime)
- [ ] dense-circuit usability (needs runtime)
- [ ] sequential authoring feel (needs runtime)
- [x] design-time error feedback missing (driver conflicts, loops, floating drivers only at export)

**Severity:** `unknown` (runtime assessment required)

### 4.4 Documentation Truth Model

**Target standard:** Current-state docs stay factual. Target-state docs stay aspirational but testable. No mixing.

**Current reality:** The manual suite is the best-governed documentation cluster. But it overclaims ~6 features. The README is severely stale. 7+ spec docs are OS-era obsolete. No target-state contract exists as a separate document. Obsidian brain has cross-file misalignments.

**Evidence:**
- Manual: 18/~100+ claims audited, 49 traced. Sections 5, 6, 8, 14-17, Appendix D-E have zero traced claims
- README: claims 3D editing, time-travel debugging, wrong test counts, wrong dev commands, OS-era branding
- Obsidian: ADR-002 missing from Canonical Notes Policy, 5 architecture notes unlisted, area field incomplete

**Gaps:**
- [x] manual overclaims
- [x] README lies
- [x] no current-state / target-state separation
- [x] 7+ obsolete docs in `docs/`
- [x] Obsidian cross-file misalignments

**Severity:** `critical` (README is the repo's front door)

---

## 5. Gap Register

| ID | Area | Gap | Severity | Evidence | Likely Files | Status |
|---|---|---|---|---|---|---|
| GAP-001 | Docs | README claims OS-era features (3D, time-travel, bug localization) | critical | code inspection | `README.md` | open |
| GAP-002 | Docs | Manual overclaims Export Grading Report, verify replay, FPGA Bridge | critical | code inspection | `docs/manuals/RedByte_Product_Manual.md` | open |
| GAP-003 | Sequential | Falling-edge detected but not blocked | high | code: vectorRunner.ts | `verifySchedule.ts`, `vectorRunner.ts` | open |
| GAP-004 | Sequential | Multi-clock detected but not blocked | high | code: verifySchedule.ts | `verifySchedule.ts`, `basys3Bundle.ts` | open |
| GAP-005 | Sequential | Active-low reset available but no reset-aware simulation | high | code: vectorRunner.ts | `vectorRunner.ts`, palette | open |
| GAP-006 | Design | Circuit errors only detected at export, not design time | high | code: basys3ExportService.ts | `DesignSurface.tsx`, export service | open |
| GAP-007 | Export | Export not gated on verify pass | medium | code: ExportSurface.tsx | `ExportSurface.tsx` | open |
| GAP-008 | Export | Pin override / HardwareSurface reconciliation missing | medium | code inspection | `ExportSurface.tsx`, `HardwareSurface.tsx` | open |
| GAP-009 | Docs | DOC_INDEX uses OS-era naming and references | medium | doc inspection | `docs/DOC_INDEX.md` | open |
| GAP-010 | Docs | 7+ obsolete spec docs in `docs/` | medium | doc inspection | see Section 3.4 | open |
| GAP-011 | Obsidian | Canonical Notes Policy missing ADR-002 and 5 architecture notes | medium | doc inspection | `08 Agents + Prompts/Canonical Notes Policy.md` | open |
| GAP-012 | Docs | Manual has ~50+ unaudited claims in sections 5-8, 14-17, App D-E | low | doc inspection | `MANUAL_TRACEABILITY_MATRIX.md` | open |
| GAP-013 | Classroom | Live Basys3 rehearsal unproven | high | Engineering Brain | hardware setup | open |
| GAP-014 | Classroom | Clean-tree classroom signoff not validated | medium | Engineering Brain | build/signoff scripts | open |

---

## 6. Product-Legitimacy Scorecard

0 = not started, 1 = building blocks exist, 2 = partially working, 3 = works but gaps, 4 = solid with minor issues, 5 = product-ready

| Category | Score | Notes |
|---|---:|---|
| Workflow coherence | 3 | Surfaces work, dependency chain enforced, but workflow spine not audited at runtime |
| Design editor legitimacy | 3 | Full palette, grid snap, macros — but interaction quality needs runtime assessment |
| Verify trust | 4 | 14 hints, drift detection, waveforms, pass/fail states — solid with minor language gaps |
| Sequential/clocked trust | 2 | Rising-edge works, but 3 unsupported boundaries pass silently |
| Export/Vivado trust | 4 | Pipeline works, cross-artifact checks, 6-case Vivado proof — minor gate gaps |
| Hardware mapping clarity | 3 | 4 modes, pin assignment, dependency chain — unproven on real hardware |
| Import clarity | 3 | Fidelity levels, behavioral blockers — not deeply assessed |
| Visual professionalism | ? | Not assessed — needs runtime inspection |
| Documentation truthfulness | 2 | Manual suite is rigorous but overclaims; README lies; no truth model separation |
| Final-manual screenshot readiness | 1 | Trust blockers and visual assessment both unresolved |

### Screenshot freeze decision
- [ ] Approved for final manual screenshots
- [x] **Not approved for final manual screenshots**

**Reason:** README lies about the product. Manual overclaims ~6 features. Sequential boundaries let invalid designs through. Visual/interaction quality not yet assessed at runtime. The product may be close, but truth blockers must be resolved before any visual freeze.

---

## 7. Recommended Phase Order

### Phase 0 — Truth setup
- **Goals:** Remove all documentation lies and overclaims. Separate current-truth from target-state.
- **Scope:** README rewrite, manual overclaim removal, Product Contract creation, Obsidian alignment
- **Proof obligations:** README matches current product. Manual has zero unverifiable claims. Product Contract exists as separate target doc.
- **Exit criteria:** GAP-001, GAP-002, GAP-009, GAP-011 closed. Product Contract skeleton approved.

### Phase 1 — Student-path trust restoration
- **Goals:** Ensure sequential path boundaries are enforced. Add design-time circuit feedback.
- **Scope:** Block or warn on falling-edge/multi-clock/active-low reset. Surface driver conflicts, combinational loops, floating drivers during design.
- **Proof obligations:** No unsupported sequential design reaches export without explicit warning. Design-time errors catch all export-blocking conditions.
- **Exit criteria:** GAP-003, GAP-004, GAP-005, GAP-006 closed.

### Phase 2 — Workflow spine alignment (needs runtime assessment first)
- **Goals:** Unify Project / rail / headers / CTA hierarchy / progress authority.
- **Proof obligations:** No surface contradicts another about done/blocked/next/why.
- **Exit criteria:** All surface transitions are consistent. Rail, header, and CTAs agree.

### Phase 3 — Design editor legitimacy (needs runtime assessment first)
- **Goals:** Wire interaction, selection, deletion, undo/redo confidence, dense-circuit editing, sequential authoring clarity.
- **Proof obligations:** A moderately complex circuit (8+ nodes) can be edited without frustration.
- **Exit criteria:** Design surface passes screenshot-worthiness bar.

### Phase 4 — Export / hardware / Vivado legitimacy
- **Goals:** Gate export on verify, reconcile pin overrides, validate fallback testbench, prove hardware path.
- **Proof obligations:** Basys3 rehearsal completed. Clean-tree signoff validated.
- **Exit criteria:** GAP-007, GAP-008, GAP-013, GAP-014 closed.

### Phase 5 — Product polish (needs runtime assessment)
- **Goals:** Layout, spacing, visual hierarchy, empty states, status language consistency.
- **Exit criteria:** All surfaces pass screenshot-worthiness bar.

### Phase 6 — Manual-grade visuals
- **Goals:** Capture canonical screenshots, update manual visuals, regenerate PDF.
- **Prerequisites:** Phase 0-4 complete. Phase 5 substantially complete.
- **Exit criteria:** Manual contains only screenshots of product-worthy states.

---

## 8. First Implementation Slice

### Highest-leverage next slice: P0 Truth Fixes
Fix the things that are provably wrong in documentation without touching application code.

### Why this slice is first
- Zero risk of breaking product functionality
- Highest credibility impact per line changed
- Unblocks all downstream work by establishing honest baselines
- Can be completed in a single batch

### Scope
1. **README.md rewrite** — Remove OS-era claims, update to match current IDE product (IdeApp, six surfaces, correct test counts, correct dev commands, correct branding)
2. **Manual overclaim removal** — Remove Export Grading Report button, verification replay, FPGA Bridge troubleshooting, LabWorkspaceApp as standalone context, LogicPlaygroundApp walkthrough. Qualify 50-level undo and searchable palette as unverified or remove.
3. **DOC_INDEX.md update** — Fix date, remove OS-era descriptions, update package references
4. **Obsidian alignment** — Add ADR-002 and missing architecture notes to Canonical Notes Policy

### Likely files
- `README.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/manuals/RedByte_Product_Manual_print.html`
- `docs/DOC_INDEX.md`
- `08 Agents + Prompts/Canonical Notes Policy.md`
- `03 Architecture/Note Schema.md` (add missing area values)

### Proof to run
- Verify README claims against actual codebase
- Verify all remaining manual claims are traceable
- Confirm Obsidian canonical notes list matches Engineering Brain

### Docs to update
- Current-state: README, Manual, DOC_INDEX, Manual Claim Audit, Traceability Matrix
- Target-state: `docs/contracts/RedByte_Product_Contract.md` (initial creation)
- Obsidian: Canonical Notes Policy, Note Schema, Engineering Brain dashboard

---

## 9. Obsidian Updates Required

### Canonical notes to update
- `01 Dashboard/RedByte Engineering Brain.md` — add gap audit reference, update next action
- `08 Agents + Prompts/Canonical Notes Policy.md` — add ADR-002, add 5 missing architecture notes
- `03 Architecture/Note Schema.md` — add `hardware`, `import`, `project` to area field values

### New notes required
- [ ] none at this time (gap audit and product contract live in `docs/`, not Obsidian)

### Workspace routing
- Primary workspace: Architecture + Planning

---

## 10. Final Judgment

### What RedByte can honestly claim today
RedByte is a working FPGA educational IDE with a deterministic simulation engine, a six-surface workflow (Project → Design → Verify → Hardware → Export → Import), and a proven export pipeline that generates valid Vivado Kit ZIPs for the Basys3 board. The core student path works for combinational circuits and rising-edge single-clock sequential circuits. The architecture is sound and well-documented.

### What RedByte must not claim yet
- 3D circuit editing (archived)
- Time-travel debugging (not implemented)
- Automatic bug localization (not a feature)
- FPGA Bridge as a shipped component (aspirational)
- Export Grading Report (not implemented)
- Verification replay (not implemented)
- LabWorkspaceApp or LogicPlaygroundApp as functioning standalone contexts
- Full sequential logic support (falling-edge, multi-clock, active-low reset are unsupported)
- Classroom readiness (hardware rehearsal and clean-tree signoff unproven)

### What must be true before final-manual screenshots are captured
1. README accurately describes the current product
2. Manual contains zero overclaims
3. Sequential path boundaries are enforced (block or warn)
4. Design-time circuit errors surface during design
5. Visual/interaction quality passes runtime assessment
6. Each surface has a canonical state that looks professional

### Next command decision
- [x] **narrow docs to current truth** (P0 — first batch)
- [ ] implement trust-critical fix (P1 — after P0)
- [ ] implement workflow spine fix (P2 — needs runtime assessment)
- [ ] implement design-legitimacy fix (P3 — needs runtime assessment)
- [ ] create / refine target product contract (parallel with P0)

---

*This audit was produced by systematic analysis of all canon docs, Obsidian vault, architecture specs, and actual surface/export/verify implementation code across 4 parallel research agents.*
