---
type: architecture
status: active
area: hardware
updated: 2026-04-16
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

## Board bring-up chrome (layout system)

- **Stage rail** (`ide-hw-stage-rail`): **Basys3 bring-up** kicker, **stage caption** (`ide-hw-stage-caption`) that updates per mode (map / bring-up / pre-flight / simulation) so progression reads as one lab workflow; optional **Sim t{n}** badge when the runtime has ticks.
- **Stage tabs**: native `role="tab"` grid — **Map Pins**, **Test on Board**, **Pre-flight**, **Simulation** — each with a title, one-line hint, and compact status glyph; active stage uses stronger border and green-forward fill. Tabs own mode navigation; the command strip meta no longer duplicates the current stage as an extra chip.
- **Board workspace** (`ide-hw-board-workspace`): framed **stage** with **chrome header** (`ide-hw-board-chrome-stage`: `Stage 1–4 · …`) plus **Basys3** and **timing mode** pills; inner **canvas** holds either split **Map Pins** (table + `Basys3BoardView`) or **HardwareBoard2D** (with pre-flight verdict overlay when relevant). Intended to read as the **center** of the workflow, not background chrome.
- **Dock spine**: left dock `SurfacePanel`s use `ide-hw-dock-panel` with a **mode-colored left border** (map / bring-up / proof / live) so checklist content ties visually to the active stage. Inspector tables stay **full opacity** with readable type — evidence and live state are not faded “secondary” panes.

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
- `packages/rb-apps/src/apps/ide/hardwareMappingV2EditorModel.ts` — structured V2 edit operations + completeness summaries for Map Pins
- `packages/rb-apps/src/apps/ide/hardwareMappingGuidance.ts` — guided boundary + HDL port catalog helpers for Map Pins authoring
- `packages/rb-apps/src/apps/ide/projectRuntime.ts` — `applyHardwareMappingEdit` keeps V2 canonical and re-materializes IO rows
- `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`
- `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx`
- `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportModel.ts`

## Structured Map Pins (hardwareMappingV2 authority)

- Map Pins must edit **`hardwareMappingV2` directly**; materialized `projectIoRows` remain the compatibility/projection view for sim/export paths that still consume flat IoMapping rows.
- The structured editor surfaces **entry kinds** (`scalar`, `bit`, `slice`, `bus`, `group`) with explicit **partial vs complete** pin coverage and optional **timingRole / boardResourceType** metadata.
- Pin assignment still flows through the same re-materialization path as `setMappingPin`, so Verify/Export drift flags stay honest when mapping changes.
- **Guided creation** should default to **boundary row + optional HDL port** pickers; raw `nodeId` / logic port are **Advanced** only. **Export repair** callouts reuse `buildExportViewModel` diagnostics so Map Pins explains the same blockers as Export with actionable navigation.

## Open Questions / Stubs

- The current Hardware page still risks reading as too dense when readiness, mapping tables, and artifact summaries are all visible together. A later UI pass should reduce that density without weakening mapping truth.
- Program-handoff detail still needs a tighter long-term contract: which parts belong on Hardware versus Export once the shared dominant status is already visible on both surfaces.
- Further polish: smarter auto-match between HDL port names and boundary labels, and richer group-member pickers over existing structured entry ids.