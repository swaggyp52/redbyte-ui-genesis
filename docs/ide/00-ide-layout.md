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

## Non-Goals (Phase 1)

1. Multi-board support (Basys3 only).
2. New product surfaces or alternate boot paths.
3. Template-first landing experience.
