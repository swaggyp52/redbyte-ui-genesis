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
- a quiet technical drawing surface with legible symbols, values and module boundaries
- hardware and Vivado claims tied to evidence tiers

## Design Rules

1. Give every surface one dominant object.
2. Use panels for tools, repeated items, and inspectors; avoid page sections that feel like cards inside cards.
3. Keep the workflow spine visible but secondary to the active task.
4. Make primary actions obvious in the first viewport.
5. Make stale, draft, ready, pass, fail, and trusted states visually distinct.
6. Reduce duplicated chips, badges, and pill labels when they repeat the same state.
7. Preserve existing typography and tokens unless a rendered comparison demonstrates a concrete problem.
8. Make the circuit, its behavior and its representations understandable together. Keep selection, logic values, mismatch and brand accents distinct.

## Surface Targets

- Project: course mission control, not a landing page.
- Design: circuit canvas is the workbench, palette and inspector are tools.
- Simulate: one recorded experiment with connected circuit, logic, table/time and repair views.
- Board: Basys3 board and binding table are the focal objects.
- Package: Vivado package handoff with trust state and primary build/download action.
- Import: utility route with clear recovery and project identity.

## Implementation Order

Start with the primary student task and a working interaction concept. For a substantial change, render materially different compositions using the same real circuit data and compare them in the browser. Choose a short design thesis, then implement the connected behavior with existing architecture and primitives. Refine the visual system after the concept works. Use `redbyte-linked-representations` for circuit correspondence and execution playback.
