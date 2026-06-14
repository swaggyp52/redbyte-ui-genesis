---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: V1 product contract reset for RedByte
---

# RedByte V1 Product Contract

This is the V1 product contract reset. It supersedes stale queue assumptions for near-term RedByte product work, but it does not rewrite shipped behavior by itself. Current behavior still lives in code, tests, `docs/manuals/RedByte_Product_Manual.md`, and proof docs.

## Product Identity

RedByte V1 is a browser-based Basys3 digital-logic lab workbench.

It helps a student:

1. Start a blank, starter, saved, or instructor-defined lab project.
2. Build a supported digital-logic circuit visually.
3. Verify behavior with observable stimulus, expected outputs, compare results, and repair evidence.
4. Map project signals to Digilent Basys3 board resources and package pins.
5. Export a coherent Vivado-ready package.
6. Continue in Vivado for synthesis, implementation, bitstream generation, programming, and observation when those proof tiers are required.

RedByte V1 is not:

- A Vivado replacement.
- A universal HDL IDE.
- A universal FPGA-board abstraction.
- A SaaS classroom-management platform.
- A hidden-answer lab system.
- A hardware-proof product without Vivado and board evidence.

## V1 Audience

| Audience | V1 promise |
|---|---|
| Student | Understand the next lab action, build and debug a circuit, verify behavior, map board IO, and export a handoff package without needing agent context. |
| Instructor / TA | See the proof boundary, assign supported Basys3 labs, inspect student artifacts, and understand what RedByte proves versus what Vivado/board observation must prove. |
| Maintainer | Use one cockpit, one work queue, one product contract, and one proof language without reviving stale OS-era docs. |

## V1 Product Spine

The RedByte-owned spine is:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

The external proof spine is:

```text
Export -> Vivado build -> Program Basys3 -> Observe board behavior
```

Import is a utility entry point. It is not part of the primary student spine.

## V1 Proof Tiers

| Tier | Name | Meaning | Owner |
|---|---|---|---|
| E0 | RedByte/browser/package proof | RedByte generated or verified browser artifacts for the current project state. | RedByte |
| E1 | Vivado build proof | Vivado synthesis, implementation, and bitstream generation completed for a named export. | External Vivado run |
| E2 | Board programming proof | A generated bitstream was programmed onto a Basys3 target. | External Vivado/Hardware Manager run |
| E3 | Board observation proof | Physical board behavior was observed against an explicit procedure. | Human or recorded lab proof |

V1 invariant: E0 can support a Vivado handoff, but E0 never proves E1, E2, or E3.

## Product State Vocabulary

| State | Contract meaning |
|---|---|
| No circuit | There is no design boundary to verify, map, or export. Do not show mapping failure copy. |
| Draft design | A circuit exists, but downstream proof may be missing or stale. |
| Observe run | Runtime outputs were recorded. This teaches behavior but is not a pass/fail proof. |
| Compare PASS | Current observed outputs match current expected outputs for the current design/testbench authority. |
| Compare FAIL | At least one expected output check differs from observed output. The first mismatch must be inspectable. |
| Pins mapped | Required top-level signals have board resource/package pin assignments. |
| Draft export | A package can be generated or inspected, but trusted proof is missing or stale. |
| E0 ready export | Design, mapping, Verify Compare, and export state are coherent for browser/package handoff. |
| Hardware proof pending | Vivado build, board programming, or board observation remains external. |

## Surface Contracts

### Global Shell

The shell must make the active job, next action, and proof boundary visible without competing status authorities.

Must:

- Use one compact workflow/status authority.
- Keep Project, Design, Verify, Map Pins, and Export navigation stable.
- Preserve E0 versus E1/E2/E3 language.
- Avoid implying hardware readiness from browser state.

Must not:

- Repeat contradictory state across ribbon, rail, panels, and CTAs.
- Let debug/build chrome dominate the student path.
- Use "ready" without naming the proof tier.

### Project Command Center

Project is the command center, not a starter gallery.

Must:

- Show blank start, certified starter, saved project, import/recovery, and future instructor lab entry as peer paths with clear priority.
- Keep no-circuit state neutral.
- Show recommended next action without requiring scroll at common laptop sizes.
- Avoid hardcoding ECE141 as the product identity.

Must not:

- Treat starter loading as the only serious path.
- Report mapping failures before a circuit exists.

### Design Workbench

Design is where the circuit graph is the object.

Must:

- Make the actual circuit graph visible and primary in the first viewport after loading a starter or project.
- Keep palette, toolbar, health, inspector, and starter context supportive.
- Keep authoring controls stable enough for repeated student edits.
- Surface circuit issues before export when possible.

Must not:

- Let banners, inspectors, or chrome displace the schematic.
- Hide circuit evidence behind dashboard cards.

### Verify Evidence Workbench

Verify is the evidence and repair loop.

Must:

- Keep Observe and Compare distinct.
- Show stimulus, expected outputs, observed outputs, pass/fail, first mismatch, and repair path as the primary hierarchy.
- Keep waveform/tick evidence readable and tied to the selected case.
- Let a student edit expected outputs, rerun, and reach terminal PASS/FAIL.

Must not:

- Present a dense control panel where the evidence is secondary.
- Show PASS when current evidence is stale or mismatched.

### Hardware / Basys3 Workbench

Hardware is the Basys3 mapping workbench.

Must:

- Show project signal -> board resource -> package pin -> XDC consequence.
- Keep the board and mapping rows visible together.
- Name Basys3 resources in student-readable terms and trace them to physical pins.
- Keep E1/E2/E3 proof external unless evidence exists.

Must not:

- Say or imply that browser state programmed or observed hardware.
- Hide mapping rows below generic hardware guidance.

### Export Handoff Station

Export is the Vivado handoff station.

Must:

- Show one current trust state: draft, needs review, E0 ready, or blocked.
- Show the primary package action in the first viewport.
- Show generated artifacts and their provenance.
- Explain what Vivado must still do.
- Keep mapping summary language consistent with the active project mapping state.

Must not:

- Say "ready to build" without E0/E1/E2/E3 boundary language.
- Contradict mapped/unmapped state in the same viewport.

### Import / Recovery

Import is a review-gated utility.

Must:

- Keep upload, parse, map ports, review schematic, and apply import as explicit steps.
- Make fidelity and warnings understandable.
- Avoid replacing the current project before review.

Must not:

- Become the default student route.
- Claim broad HDL migration fidelity without representative proof.

## V1 Work Order

The approved execution order is:

1. V1 Contract Reset.
2. Under-the-Hood Mastery Sprint.
3. Export Trust Integrity.
4. Verify Evidence Workbench.
5. Shell and Workbench Layout Reset.
6. Project Command Center.
7. Export Handoff Station.
8. Hardware / Basys3 Workbench.
9. Design Workbench.
10. Import / Recovery.
11. Lab Profile / Course Pack Data Seam. Closed locally 2026-06-14.
12. Student/Instructor Quickstarts. Closed locally 2026-06-14.
13. Vivado/Basys3 Proof Restoration.
14. Packaging/Commercial Readiness.

## Non-Negotiables

- Do not weaken tests to match a design plan.
- Do not change simulation, Verify result semantics, pin mapping semantics, export generation, project data format, goldens, or hardware proof in layout-only slices.
- Do not claim live/student deployment from a GitHub push unless deployment evidence confirms it.
- Do not add accounts/SaaS before a concrete hosted-data requirement exists.
- Do not treat course packs or lab profiles as more urgent than the core workbench hierarchy.
- Do not make a hardware claim without E1/E2/E3 evidence for the named project class.

## Definition Of Done For A Product Slice

A V1 product slice is done only when:

- The product complaint is translated into the hardening ticket fields.
- The smallest reversible code or docs change is made.
- Focused tests/gates pass.
- Browser proof covers the affected surface at common viewports.
- Current-truth docs and cockpit docs are updated.
- The slice is committed and pushed when requested.
- GitHub required checks are inspected from live GitHub evidence.

## Attribution

Connor Angiel
