---
doc_status: current
last_validated: 2026-04-28
owner: Connor Angiel
used_by_claude: true
role: target-state product blueprint
---

# RedByte Product Contract

**Status:** Draft v0.1
**Date:** 2026-04-01
**Owner:** Claude / Connor
**Purpose:** Defines the target product standard for RedByte. This is the blueprint the implementation is expected to converge toward.

> This document is not the current-state manual.
> It defines the intended product behavior, quality bar, and proof obligations.
> The manual documents current truth. This contract defines target truth.

---

## 1. Product Identity

### 1.1 Product statement
RedByte is a deterministic, local-first FPGA educational IDE for teaching digital logic and computer architecture to university students using the Digilent Basys3 board.

### 1.2 Product promise
RedByte must enable a user to:
1. Design a digital circuit with confidence
2. Verify its behavior with trustworthy feedback
3. Understand its mapping to real hardware
4. Export a real, coherent Vivado-ready package
5. Move through the workflow without contradictory signals or fake readiness

### 1.3 What RedByte is not
- Not a replacement for Vivado (it generates artifacts for Vivado, does not replace it)
- Not a general-purpose HDL editor
- Not a cloud service
- Not a game or toy
- Not a dumbed-down tool that hides real engineering
- Not a docs-first illusion that pretends to be more than it is

---

## 2. Two-Layer Documentation Model

### 2.1 Enforcement rule
- The current-state manual must never overclaim to match this contract
- This contract must not be weakened just because the current app falls short
- When implementation changes, both layers must be reviewed

### 2.2 Source-of-truth map
| Need | Canonical Source |
|---|---|
| Current product behavior | `docs/manuals/RedByte_Product_Manual.md` |
| Claim verification | `docs/manuals/MANUAL_CLAIM_AUDIT.md` |
| Claim → source linkage | `docs/manuals/MANUAL_TRACEABILITY_MATRIX.md` |
| Update triggers | `docs/manuals/MANUAL_CONFORMANCE.md` |
| Product target standard | This document |
| Gap assessment | `docs/roadmap/RedByte_Gap_Audit.md` |
| Working memory / architecture / bugs | Obsidian brain |

---

## 3. Product Pillars

| Pillar | Meaning |
|---|---|
| **Trust** | The user must be able to trust what the product says |
| **Legibility** | The workflow, UI, and language must be understandable without internal knowledge |
| **Determinism** | Simulation, verification, and generated outputs must be stable and reproducible |
| **Coherence** | All six surfaces must behave like one product |
| **Professionalism** | The tool must look and feel intentional enough to be documented as a real product |

---

## 4. Surface Contracts

### 4.1 Global Shell Contract
The shell must provide a stable workflow spine, unambiguous active surface indication, shared done/blocked/next/why authority, and non-contradictory status and CTA signaling.

**Must not:** Contradict the active surface. Imply readiness that does not exist. Fragment terminology.

### 4.2 Project Surface
**Promise:** Student identity, project metadata, and entry point to the workflow.

**Must do:** Accept student name and lab metadata. Show project readiness with clear step progression. Provide starter examples and lab gallery. Never lose student metadata across mode switches.

**Screenshot-worthy when:** Step progression is clear, readiness indicators are honest, surface feels like a professional project launcher.

### 4.3 Design Surface
**Promise:** A legitimate schematic editor where circuits feel real.

**Must do:** Place, wire, move, select, delete components. Support all palette components. Provide undo/redo with confidence. Show inline warnings for design errors (driver conflicts, combinational loops, floating drivers). Support dense circuit editing without frustration. Make sequential authoring feel intentional.

**Screenshot-worthy when:** Wiring is clean, selection is clear, inspector is useful, a moderately complex circuit (8+ nodes) looks professional.

### 4.4 Verify Surface
**Promise:** Truthful simulation results with clear pass/fail semantics.

**Must do:** Run scenarios and display pass/fail with evidence. Show waveforms that match simulation reality. Explain failures with actionable hints. Distinguish combinational from sequential verification. Never show "PASS" when the circuit is wrong.

**Screenshot-worthy when:** Waveforms are readable, pass/fail is unambiguous, failure explanation is genuinely helpful.

### 4.5 Hardware Surface
**Promise:** Confident mapping from schematic to physical Basys3 board.

**Must do:** Map circuit I/O to Basys3 pins. Enforce dependency chain (Verify → Export → Program). Detect and warn on scenario drift. Make the board feel real.

**Screenshot-worthy when:** Pin mapping is intuitive, dependency chain is visible, board visualization looks like real hardware.

### 4.6 Export Surface
**Promise:** Generate a Vivado Kit that works in Vivado without modification.

**Must do:** Produce valid VHDL, XDC, testbench, TCL, and README. Verify cross-artifact consistency. Show preview of generated artifacts. Provide clear Vivado import instructions. Label exports without a current assertion-backed Verify PASS as draft/debug, not trusted. Validate clock/reset contracts for sequential circuits.

**Screenshot-worthy when:** Rebuild pipeline is clear, artifacts are previewable, Vivado instructions are self-explanatory.

### 4.7 Import Surface
**Promise:** Import VHDL into RedByte with honest fidelity reporting.

**Must do:** Parse structural VHDL. Report import fidelity (Full, Reconstructed, Partial). Never silently drop components or connections. Provide behavioral blocker callouts.

**Screenshot-worthy when:** Fidelity reporting is honest and imported circuit appears correctly in Design.

---

## 5. Trust Contracts

### 5.1 Simulation Trust
- **Determinism:** Same circuit + same vectors = same results, always
- **Integer signals:** All signals are integer-valued, no floating-point artifacts
- **Topological sort:** Evaluation order is deterministic
- **Clock semantics:** Rising-edge capture is the supported clocking model

### 5.2 Sequential Logic Trust

**Supported (proven):**
- DFlipFlop, TFlipFlop, JKFlipFlop with rising-edge clock
- Single clock domain
- Sim clock injection when no physical clock is mapped

**Detected but unsupported (must warn or block):**
- Falling-edge sequential logic
- Multi-clock domains
- Active-low reset
- Asynchronous sequential logic

**Not detected (audit needed):**
- Any silent failure modes where unsupported patterns produce wrong results without warning

### 5.3 Export Trust
- Generated VHDL must be syntactically valid
- XDC must target correct Basys3 part (xc7a35t-1cpg236-1)
- Testbench ports must match entity ports (cross-artifact consistency)
- Preview must show exact bytes that go into the ZIP
- Clock constraint must be correct for 100MHz W5 pin

### 5.4 Integrity Trust
- SHA-256 content-addressed hashing for all submissions
- Deterministic ZIP output (same circuit → same bytes)
- Optional Ed25519 signing

---

## 6. Quality Bar Definitions

### 6.1 "Product-Ready" (Minimum for Lab Use)
- [ ] Student path (Design → Verify → Export → Vivado) works end-to-end for combinational circuits
- [ ] Student path works end-to-end for single-clock rising-edge sequential circuits
- [ ] All critical circuit errors surface before export, not only during export
- [ ] No manual claims describe features that don't exist
- [ ] README accurately describes the product
- [ ] Generated Vivado Kit works in Vivado 2024.2 without modification

### 6.2 "Screenshot-Worthy" (Minimum for Manual Visuals)
- [ ] All P0 and P1 gap audit items resolved
- [ ] Each surface has at least one canonical state that looks professional
- [ ] Workflow transitions are smooth
- [ ] Typography, spacing, and visual hierarchy are consistent
- [ ] No embarrassing empty states or broken layouts in the canonical path

### 6.3 "Classroom-Confident" (Minimum for Instructor Signoff)
- [ ] Live Basys3 hardware rehearsal completed successfully
- [ ] Clean-tree classroom signoff validated
- [ ] At least one complete lab (design → verify → export → program) rehearsed
- [ ] Instructor quickstart guide is accurate
- [ ] Student-facing error messages are all actionable

---

## 7. Release Gates

### Gate 1: Code Truth
- `pnpm build:unified` → EXIT 0
- `pnpm -w exec vitest run` → all pure-logic tests pass
- No TypeScript strict-mode errors

### Gate 2: Export Truth
- Combinational circuit exports produce valid Vivado Kit
- Sequential (single-clock, rising-edge) circuit exports produce valid Vivado Kit
- Cross-artifact consistency check passes for both
- Generated XDC has correct clock constraints

### Gate 3: Documentation Truth
- Product Manual contains zero overclaims
- README matches current product
- No obsolete spec documents are referenced as current-truth
- Traceability matrix covers all major manual claims

### Gate 4: Classroom Truth
- Lab-day walkthrough completed by instructor
- Student-facing workflow tested with real student
- Hardware deployment rehearsed with real Basys3

---

## 8. Proof Obligations Matrix

| Area | What must be proven | Evidence type | Status |
|---|---|---|---|
| Combinational path | Design → Verify → Export → Vivado works for AND/OR/XOR circuits | runtime + Vivado validation | proven (6-case matrix, 2026-03-30) |
| Sequential path | Rising-edge DFF/TFF/JKFF path works end-to-end | runtime + Vivado validation | proven (2026-03-30) |
| Sequential boundaries | Falling-edge/multi-clock/reset are blocked or warned | code inspection + runtime | **not proven** |
| Design-time feedback | Driver conflicts, loops, floating drivers caught during design | runtime | **not proven** |
| Export integrity | Preview = ZIP bytes | code inspection | proven (single codepath) |
| Hardware rehearsal | Real Basys3 programming from exported kit | hardware test | **not proven** |
| Manual accuracy | Zero overclaims | doc audit | **not proven** (6+ overclaims found) |
| README accuracy | Matches current product | doc audit | **not proven** (OS-era claims) |

---

## 9. Definition of Done by Major Area

### 9.1 Workflow
Done when: Rail, headers, CTAs, and status pills agree across all surfaces about done/blocked/next/why. No surface contradicts another.

### 9.2 Design editor
Done when: A moderately complex circuit (8+ nodes) can be placed, wired, selected, deleted, and undone without frustration. Sequential authoring feels intentional. Design-time errors surface inline.

### 9.3 Verify
Done when: Pass/fail has precise meaning. Failing guidance is grounded. Sequential timing language is consistent with Design and Export. No fake certainty.

### 9.4 Sequential/clocked path
Done when: All detected-but-unsupported boundaries (falling-edge, multi-clock, active-low reset) are explicitly blocked or warned. Clock language is consistent across Design, Verify, Export, and docs.

### 9.5 Export / Vivado
Done when: Export distinguishes draft buildable artifacts from trusted verified handoff. Pin overrides reconcile with HardwareSurface. Fallback testbench is validated. Generated artifacts work in Vivado without modification.

### 9.6 Hardware mapping
Done when: Live Basys3 rehearsal completed. Clean-tree signoff validated. Pin mapping is intuitive enough for students.

### 9.7 Import
Done when: Fidelity reporting is clear. Behavioral blockers are actionable. Imported circuits appear correctly in Design.

### 9.8 Visual polish
Done when: All surfaces pass screenshot-worthiness bar. Layout, spacing, typography, and empty states are consistent and professional.

---

## 10. Current Gap Against Contract

### Active blockers
See: `docs/roadmap/RedByte_Gap_Audit.md`

### Current most important unmet contracts
1. **Documentation truth** — README lies, manual overclaims (Gap Audit P0)
2. **Sequential boundary enforcement** — detected but not blocked (Gap Audit P1)
3. **Design-time feedback** — circuit errors only at export (Gap Audit P1)

### Deferred until product-legit
- Final manual screenshot capture
- Final visual freeze
- Presentation-grade PDF refinement beyond current truth needs

---

## 11. Change Control

### When this contract must be updated
- Surface purpose changes
- Workflow stage meaning changes
- Generated output contract changes
- Terminology changes
- Readiness or trust semantics change

### Required companion updates
When this contract changes, also review: Product Manual, Claim Audit, Traceability Matrix, Conformance doc, relevant Obsidian architecture notes, Engineering Brain dashboard.

---

*This contract will be expanded as implementation progresses. Each section should be updated when its corresponding implementation is proven.*
