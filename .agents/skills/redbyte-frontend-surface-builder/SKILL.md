---
name: redbyte-frontend-surface-builder
description: Use when implementing or reshaping RedByte frontend surfaces, workbench layouts, visual hierarchy, or student-facing controls.
---

# RedByte Frontend Surface Builder

Use this skill before changing RedByte UI source under `packages/rb-apps/src/apps/ide/**`, CSS surface rules, shell chrome, or browser gates.

## Startup

Read `AGENTS.md`, `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, and the relevant surface contract before editing. For product/UX work, also read `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`, `docs/IDE_SYSTEM_MAP.md`, and `docs/ide/SURFACE_CONFORMANCE.md`.

## Product Direction

- Build the usable workbench, not a landing page.
- Make the current work object dominant: graph, waveform/evidence, board/table, handoff package, recovery candidate, or Project identity/action.
- Avoid card walls, nested cards, persistent dead side space, duplicate status authorities, and decorative chrome that does not help a student act.
- Use existing RedByte primitives and CSS patterns before creating new component styles.
- Keep fixed-format controls dimensionally stable with explicit sizing, min/max constraints, and overflow handling.
- Use direct controls for direct actions: buttons, toggles, inputs, menus, sliders, and tabs. Do not make important labels look important but behave inertly.
- Keep text readable and contained at `1366x768` and `1440x900`; do not use negative letter spacing in newly touched rules.

## Boundaries

Do not change simulation, Verify semantics, pin mapping semantics, VHDL/XDC/testbench/Tcl/ZIP generation, project format, goldens, SaaS/accounts, or hardware proof claims unless the observed product defect directly requires it.

## Proof

For a UI/product slice, add or update one focused browser gate that reproduces the observed user behavior. Capture before/after screenshots under `.redbyte/product-immersion/**`, verify the visible build hash matches HEAD, run affected surface gates, `classroom:gate`, `build:unified`, docs validation, encoding check, and `git diff --check`.
