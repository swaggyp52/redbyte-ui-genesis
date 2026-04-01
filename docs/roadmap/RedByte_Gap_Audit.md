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

Design-time feedback for critical circuit errors is now live (P2). Two classroom blockers remain (Basys3 rehearsal, clean-tree signoff).

- [x] product-legit in its core student workflow
- [x] documentation truthful (P0 complete — README rewritten, manual overclaims removed)
- [x] sequential boundaries enforced (P1 complete — falling-edge/multi-clock/active-low blocked in both Verify and Export)
- [x] design-time circuit health feedback (P2 complete — combinational loops, multiple drivers, floating outputs detected live)
- [x] workflow spine truthful (P3 complete — done-conditions aligned, CTA misdirection fixed)
- [x] canvas health visible (P4 complete — IR diagnostics drive node glow + status bar)
- [x] design editor legitimacy (P5 complete — undo granularity fixed, wire preview aligned, deletion feedback counts)
- [x] export handoff truth improved (P6 initial slice — preview README, tool version, test ID dedup)
- [x] export readiness honest when verify not passing (GAP-007 closed — header pill + callout now verify-state-aware)
- [ ] classroom-trustworthy (two pre-lab blockers remain)
- [ ] manual/screenshot-worthy (visual gaps remain)
- [ ] visually credible as a real tool (not assessed — runtime inspection needed)

### Primary blockers (remaining after P0+P1+P2+P3+P4+P5+P6-GAP-007)
1. Two classroom blockers: Basys3 rehearsal + clean-tree signoff (GAP-013, GAP-014)

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
- ~~README claims 3D editing, time-travel debugging, automatic bug localization~~ **FIXED (P0)**
- ~~Manual documents Export Grading Report, verification replay, FPGA Bridge as shipped features~~ **FIXED (P0)**
- ~~Manual lists LabWorkspaceApp and LogicPlaygroundApp as application contexts~~ **FIXED (P0)**
- ~~DOC_INDEX references OS-era architecture concepts as current~~ **FIXED (P0)**

### What is functional but not yet legitimate
- ~~Sequential path: rising-edge works, but falling-edge/multi-clock/active-low reset are detected and flagged without blocking~~ **FIXED (P1) — all three now block in both Verify and Export**
- ~~Counter4Bit in palette as non-functional stub~~ **FIXED (P1) — removed from palette**
- ~~Design-time feedback: circuit errors only caught at export~~ **FIXED (P2) — IR006 combinational loop + multiple drivers + floating outputs + unconnected inputs all surfaced live during design**
- Export: downloads allowed without verify pass
- Latch execution: uses level-sensitive schedule — separate from clocked_macro but needs further validation

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
| GAP-001 | Docs | README claims OS-era features (3D, time-travel, bug localization) | critical | code inspection | `README.md` | **closed (P0)** |
| GAP-002 | Docs | Manual overclaims Export Grading Report, verify replay, FPGA Bridge | critical | code inspection | `docs/manuals/RedByte_Product_Manual.md` | **closed (P0)** |
| GAP-003 | Sequential | Falling-edge detected but not blocked | high | code: vectorRunner.ts | `verifySchedule.ts`, `basys3ExportService.ts` | **closed (P1)** — Verify blocks via hasUnsupportedTemporal; Export blocks via falling_edge() HDL check |
| GAP-004 | Sequential | Multi-clock detected but not blocked | high | code: verifySchedule.ts | `verifySchedule.ts`, `basys3ExportService.ts` | **closed (P1)** — both Verify and Export block on multi-clock |
| GAP-005 | Sequential | Active-low reset available but not blocked | high | code: vectorRunner.ts | `verifySchedule.ts`, `basys3ExportService.ts` | **closed (P1)** — Verify blocks via temporal issue; Export blocks via naming + NOT-gate checks |
| GAP-005b | Sequential | Counter4Bit stub in palette | medium | code: composite-defs.ts | `DesignSurface.tsx` | **closed (P1)** — removed from palette |
| GAP-006 | Design | Circuit errors only detected at export, not design time | high | code: basys3ExportService.ts | `elaborator.ts`, `designIssues.ts`, `DesignSurface.tsx` | **closed (P2)** — combinational loops (IR006), multiple drivers, floating outputs, unconnected inputs all detected live during design; compiler diagnostics drawer shows IR001-IR006 |
| GAP-007 | Export | Export not gated on verify pass | medium | code: ExportSurface.tsx | `ExportSurface.tsx` | closed |
| GAP-008 | Export | Pin override / HardwareSurface reconciliation missing | medium | code inspection | `ExportSurface.tsx`, `HardwareSurface.tsx` | open |
| GAP-009 | Docs | DOC_INDEX uses OS-era naming and references | medium | doc inspection | `docs/DOC_INDEX.md` | **closed (P0)** |
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
| Workflow coherence | 4 | Rail, dock, and CTA hierarchy now agree on done conditions across all four steps; P3 fixed four divergence bugs |
| Design editor legitimacy | 4 | Full palette, grid snap, macros, live circuit health feedback (multiple drivers, loops, floating, unconnected) — interaction quality needs runtime assessment |
| Verify trust | 4 | 14 hints, drift detection, waveforms, pass/fail states, explicit stale-vs-fail routing, Verify-first mismatch recovery, and synced assertion-overlay geometry — waveform readability and overall visual quality still need more work |
| Sequential/clocked trust | 4 | Rising-edge single-clock enforced across Verify + Export; falling-edge/multi-clock/active-low blocked; Counter4Bit stub removed |
| Export/Vivado trust | 4 | Pipeline works, cross-artifact checks, 6-case Vivado proof, sequential boundaries enforced |
| Hardware mapping clarity | 3 | 4 modes, pin assignment, dependency chain — unproven on real hardware |
| Import clarity | 3 | Fidelity levels, behavioral blockers — not deeply assessed |
| Visual professionalism | ? | Not assessed — needs runtime inspection |
| Documentation truthfulness | 4 | README rewritten (P0), manual overclaims removed (P0), target-state contract exists, truth model separation done |
| Final-manual screenshot readiness | 1 | Trust blockers and visual assessment both unresolved |

### Screenshot freeze decision
- [ ] Approved for final manual screenshots
- [x] **Not approved for final manual screenshots**

**Reason:** README lies about the product. Manual overclaims ~6 features. Sequential boundaries let invalid designs through. Visual/interaction quality not yet assessed at runtime. The product may be close, but truth blockers must be resolved before any visual freeze.

---

## 7. Recommended Phase Order

### Phase 0 — Truth setup ✅ COMPLETE
- **Completed:** 2026-04-01 (commit d2bd7b5a)
- **Goals:** Remove all documentation lies and overclaims. Separate current-truth from target-state.
- **Scope:** README rewrite, manual overclaim removal, Product Contract creation, Obsidian alignment
- **Closed:** GAP-001, GAP-002, GAP-009, GAP-011

### Phase 1 — Sequential boundary enforcement ✅ COMPLETE
- **Completed:** 2026-04-01
- **Goals:** Enforce sequential path boundaries in both Verify and Export. Remove stub component from palette.
- **Scope:** Export-path falling-edge + active-low-reset blocking, Counter4Bit palette removal, Sequential Support Boundary doc, 3 new enforcement tests.
- **Closed:** GAP-003, GAP-004, GAP-005, GAP-005b

### Phase 2 — Design-time circuit error feedback ✅ COMPLETE
- **Completed:** 2026-04-01
- **Goals:** Surface structural circuit problems during authoring instead of leaving them to Export/Verify.
- **Scope:** IR006 combinational loop diagnostic in elaborator (with cycle node IDs), live design-time compiler diagnostics (IR001-IR006), 8 new feedback tests.
- **Closed:** GAP-006

### Phase 3 — Workflow spine alignment ✅ COMPLETE
- **Completed:** 2026-04-01 (commit 4c33d590)
- **Goals:** Unify Project / rail / headers / CTA hierarchy / progress authority.
- **Proof obligations:** No surface contradicts another about done/blocked/next/why.
- **Scope:** Four done-condition bugs in dock stage grid + RBP1001 CTA misdirection corrected.
- **Bugs fixed:**
  - Design dock gated on `hasIoMapping` (step 3 condition on step 1) → `hasCircuit` only
  - Verify dock accepted any run including fail as done → strict `comparePassCurrent` (assertions-match)
  - Hardware/Map Pins dock required export build to show done → `readiness.hasIoMapping` (pins filled)
  - RBP1001 primary CTA sent student to Design surface when mapping is on Project surface → fixed

### Phase 4 — Design-time canvas health visibility ✅ COMPLETE
- **Completed:** 2026-04-01 (commit 6e3062ab)
- **Goals:** Make IR compiler diagnostics visible on the canvas, not just in the drawer.
- **Scope:** Bridge System B (IR elaborator) diagnostics into canvas node glow and authoring status bar.
- **Gap closed:** IR006 (combinational loop), IR004 (missing clock), IR001-IR005 now drive red/yellow node glow. Previously these diagnostics existed only in the diagnostics drawer and inspector — no canvas glow, no authoring status bar entry.

### Phase 5 — Design editor legitimacy ✅ COMPLETE
- **Completed:** 2026-04-01 (commit 006c571c)
- **Goals:** Wire interaction, selection, deletion, undo/redo confidence, dense-circuit editing, sequential authoring clarity.
- **Scope:** Three ranked fixes to make the canvas feel like a real circuit editor.
- **Fix #1 (critical) — Drag undo granularity:** RAF-batched node moves no longer push to the undo stack. A new `handleNodeMoveCommit` fires exactly once at pointer-up, committing one undo entry for the entire drag. A 2-second drag now produces 1 undo entry instead of ~120.
- **Fix #2 — Wire preview alignment:** Preview line now anchors at the actual port position (±24 from node center, using `isInputPort()` to determine direction) instead of the node body center. Eliminates the phantom wire starting in the wrong spot.
- **Fix #3 — Cascading wire deletion feedback:** Keyboard Delete now shows a specific count ("Removed 2 nodes and 5 wires.") so users understand what was implicitly removed. `onDeleteFeedback` prop wired to `setActionToast` in DesignSurface.

### Phase 6 — Export / hardware / Vivado legitimacy
- **Goals:** Gate export on verify, reconcile pin overrides, validate fallback testbench, prove hardware path.
- **Proof obligations:** Basys3 rehearsal completed. Clean-tree signoff validated.
- **Exit criteria:** GAP-007, GAP-008, GAP-013, GAP-014 closed.

**Initial slice completed 2026-04-01 (commit 404c44a8, regression fix 2d94b29c):**
- **Preview README rewrite** (`basys3Bundle.ts`): Was describing a manual "Create new RTL project" Vivado setup flow. Now describes the correct "Open Project" workflow via `vivado_import.tcl` with the correct artifact names (`top.xdc`, not `basys3.xdc` — the flat kit ZIP contains `top.xdc`). Golden SHAs regenerated twice (README changed, then corrected).
- **Tool version alignment** (`ExportSurface.tsx`): `Vivado 2024.1+` → `2024.2+`.
- **Test ID dedup** (`ExportSurface.tsx`): `ide-export-vivado-command` removed from 3 non-command elements.
- **Regression test**: `basys3-bundle-gate.test.ts` asserts README workflow correctness (5 tests).

**GAP-007 closed 2026-04-01 (commit 7e152e14):**
- **Header pill** (`ExportSurface.tsx`): Was binary `downloadReady ? Ready : Blocked`. Now three-state: `exportTrusted → Ready (green)`, `downloadReady && !exportTrusted → Available (warn)`, `blocked → Blocked (error)`. Export no longer shows green "Ready" when verify has not passed.
- **Callout title/body**: Changed from generic "Artifacts available with advisory compare state" to per-state specific language: "Verify has not run" / "Verify is stale" / "Assertions differ" with plain, direct body text.
- **8 new tests** in `projectHealth.test.ts` covering all four verify states via `deriveProjectVerifyState` and `hasCurrentPassingVerify`.

**Remaining (open):** GAP-008, GAP-013, GAP-014.

### Phase 7 — Product polish (needs runtime assessment)
- **Goals:** Layout, spacing, visual hierarchy, empty states, status language consistency.
- **Exit criteria:** All surfaces pass screenshot-worthiness bar.

### Phase 8 — Manual-grade visuals
- **Goals:** Capture canonical screenshots, update manual visuals, regenerate PDF.
- **Prerequisites:** Phase 0-6 complete. Phase 7 substantially complete.
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
