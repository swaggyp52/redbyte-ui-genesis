---
name: redbyte-design-direction
description: Use when shaping RedByte UI direction, visual hardening, design-system cleanup, surface hierarchy, and the Course Lab Workbench product feel.
---

# RedByte Design Direction

## Product Feel

RedByte should feel like a serious course lab workbench:

- a real circuit canvas, proof bench, board map, and Vivado handoff path
- calm density, clear hierarchy, and engineering credibility
- educational language without toy styling
- dark UI used for focus, not generic cyberpunk decoration
- hardware and Vivado claims tied to evidence tiers

## Design Rules

1. Give every surface one dominant object.
2. Use panels for tools, repeated items, and inspectors; avoid page sections that feel like cards inside cards.
3. Keep the workflow spine visible but secondary to the active task.
4. Make primary actions obvious in the first viewport.
5. Make stale, draft, ready, pass, fail, and trusted states visually distinct.
6. Reduce duplicated chips, badges, and pill labels when they repeat the same state.
7. Normalize typography and spacing through shared primitives before per-surface polish.

## Surface Targets

- Project: course mission control, not a landing page.
- Design: circuit canvas is the workbench, palette and inspector are tools.
- Verify: proof bench with Compare result, waveform evidence, and repair path.
- Hardware / Map Pins: Basys3 board and binding table are the focal objects.
- Export: Vivado package handoff with trust state and primary build/download action.
- Import: utility route with clear recovery and project identity.

## Implementation Order

Start with tokens and shared primitives, then fix Project/Design/Hardware/Export/Verify surface hierarchy in narrow slices with browser proof.
