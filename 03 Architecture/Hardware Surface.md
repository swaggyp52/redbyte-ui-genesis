---
type: architecture
status: active
area: hardware
updated: 2026-04-14
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Project Surface]]"
  - "[[Export Contracts]]"
  - "[[Basys 3 Mapping]]"
  - "[[BUG-018 Hardware Export Mapping Authority Drift]]"
  - "[[BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg]]"
  - "[[Note Schema]]"
---

# Hardware Surface

## Overview

This note defines the Map Pins / Hardware surface contract. Its purpose is to keep physical I/O mapping, board readiness, and program handoff legible without turning Hardware into a second Export page or a second Verify workflow.

## Canonical Shape / Contract

Hardware is the physical-realization surface in the RedByte workflow.

- it turns circuit-facing boundary IO into explicit board-facing assignments
- it explains whether the project is ready for board use or what is still blocking that handoff
- it shares dominant readiness truth with Export, while keeping the mapping workflow visibly separate from artifact-generation workflow

The core Hardware loop is:

1. identify unmapped or risky boundary signals
2. assign or review board resources
3. confirm the board-facing readiness story
4. continue to program handoff or downstream export packaging

The student-facing Hardware surface should therefore present:

- one dominant readiness state and primary CTA aligned with shared workflow authority
- a mapping-first workspace where board resources, assigned pins, and unresolved rows are easy to inspect
- enough board context to explain why a mapping is safe, missing, conflicting, or review-worthy
- downstream artifact / handoff context only as summary evidence, not as the main work area
- unresolved required top-level ports reported by Export must count as unresolved mapping in Hardware status, even when local mapping rows look complete
- blank/custom projects with no boundary I/O must still open on Map Pins with a Design-first empty state, not on proof/program framing

## Rules

- Hardware must not become a second Design surface, Verify workbench, or export bundle builder.
- Mapping is the primary job of this surface. If the student needs to edit circuit structure, author stimulus, or generate artifacts, route back to the owning surface.
- Hardware and Export must use the same dominant status vocabulary, message hierarchy, and primary CTA for the same workflow condition.
- Hardware map readiness must include export-required missing ports (`RBEX1001` style gaps), not only local required mapping-row gaps.
- If there are no boundary I/O rows yet, Hardware defaults to `Map Pins` mode and teaches the student to add boundary inputs/outputs in Design.
- Combinational designs with no required timing-control row are timing-ready for map status; absence of a clock row is not itself a blocker.
- Hardware should speak in physical board terms: switches, buttons, LEDs, segments, clock, headers, and assigned pins.
- Strict bridge-backed hardware readiness requires both FTDI / USB visibility and a working Digilent JTAG CLI path (`djtgcfg` or an override path via env). Driver-only Digilent Runtime detection is not enough to call an attached board ready for Basys3 programming.
- Mapping changes are project truth and may make Verify or Export stale; the surface must explain that without pretending to own those workflows.
- Board-readiness summary should stay concise and actionable. Do not bury unresolved mappings behind artifact-heavy chrome.

## Consumption Sites

- `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`
- `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx`
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportModel.ts`

## Open Questions / Stubs

- The current Hardware page still risks reading as too dense when readiness, mapping tables, and artifact summaries are all visible together. A later UI pass should reduce that density without weakening mapping truth.
- Program-handoff detail still needs a tighter long-term contract: which parts belong on Hardware versus Export once the shared dominant status is already visible on both surfaces.