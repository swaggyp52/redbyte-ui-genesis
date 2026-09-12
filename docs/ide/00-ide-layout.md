---
doc_status: current
last_validated: 2026-05-02
owner: Connor Angiel
used_by_claude: true
role: IDE shell layout contract
---

# RedByte IDE Layout Contract

Status: Draft v1 (Phase 1 lock)
Scope: `packages/rb-apps/src/apps/IdeApp.tsx` default `/` IDE surface


## Current P2.6B panel and Board Check composition (2026-09-12)

An empty Simulate workspace presents its start actions without an empty instrument or premature mapping warning. External VCD evidence remains an explicit independent path.

Review refinement: secondary Reproduce uses the same control height as Run, and the circuit disclosure close control remains sticky and reachable. Keyboard focus is visible within the Time instrument.

Workspace navigation creates no object tabs. At constrained effective width (including larger
root text), only one auxiliary side panel is shown; visible panel recovery and per-workspace
preferences remain. Split Design starts with its circuit/source pair. Run-specific status
stays in Simulate; the global status bar carries save/problems context.

Board assignments retain their board/mapping grammar. Board Check is one light main frame:
board first, actual step controls and stimulus/expected/recorded table underneath, visible
Back to assignments. It reads the retained recording at each selected step and never uses
the exploratory I/O bus as evidence. The recorded Board view retains saved mappings after
current edits and names that context; current assignments still withhold stale projections.

## Product Identity

RedByte IDE is a deterministic Basys3 FPGA workflow surface:

1. Project
2. Design
3. Verify
4. Board & Constraints (internal id: hardware)
5. Export
6. Import

No launcher chrome, no OS metaphors, no template carousel on default route.

## Global Shell (All Modes)

1. Top Bar (always visible)
- Left: product mark, project name, save state.
- Center: board target badge locked to Basys3.
- Right: contextual actions (`Run Verify`, `Export`, `Help`).

2. Left Rail (always visible)
- Six mode entries: Project, Design, Verify, Hardware, Export, Import.
- Active marker and simple progress indicator.

3. Main Content (mode-specific)
- One primary content region with deterministic mode marker.

4. Right Inspector (contextual)
- Collapsible secondary panel.
- Required in Design and Import.
- Lightweight in Verify and Export.

5. Status Bar (minimal)
- Build version, deterministic hash hint, last gate status.

## Interaction Rules

1. Mode switches are explicit, no auto-hopping.
2. Empty states always include one primary CTA and one secondary action.
3. Error states are actionable and never silent.
4. Success states use explicit, deterministic language (`PASS`, `READY`, `EXPORTED`).

## Bottom panel and dock preferences (2026-09-07, current)

1. One bottom panel, on every workspace
- The panel exists on Project, Design, Simulate, Board & Constraints and Build & Export alike.
  Whether there is anything to report is the panel's answer to give, not a reason for it to
  disappear; an empty ledger says "No problems. Every authority reports clean."
- The status bar's problems count opens it, expanded. A count that opens nothing is worse than a
  panel that reports nothing.
- Its own bar carries the control that puts it away, and hiding it leaves a strip that brings it
  back. A layout reset also recovers it.
- The splitter is operable from the keyboard.

2. Preferences are per surface
- Each of the three docks remembers visibility, size and expansion for the workspace it is on.
  Opening Problems on Project is not a statement about Design.
- Leaving a workspace and coming back restores what that workspace was left in, and a change in the
  problem count never silently overrides it.

3. Shortage of room
- The frame must survive both forms: a large text setting inside a fixed viewport, and browser zoom,
  which shrinks the CSS viewport under everything at once. They fail at different settings and both
  are measured (`chrome-priority-probe.mjs`, `bottom-panel-zoom-probe.mjs`).
- No control may draw outside its own box, take a click meant for its neighbour, or shrink one of
  the six frame priorities to make room for something that is not one of them.
- The panel's cap belongs to its grid track, so the panel fills what it is given; its bar keeps its
  height and its content scrolls.

4. Save state
- With nothing open there is no work to save. The frame says "No project" with a neutral mark and a
  Save that explains why it is disabled, rather than reporting unsaved changes to a placeholder.

## Non-Goals (Phase 1)

1. Multi-board support (Basys3 only).
2. New product surfaces or alternate boot paths.
3. Template-first landing experience.
