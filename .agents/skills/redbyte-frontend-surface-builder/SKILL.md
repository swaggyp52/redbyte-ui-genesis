---
name: redbyte-frontend-surface-builder
description: Use when implementing or reshaping RedByte frontend surfaces, workbench layouts, visual hierarchy, or student-facing controls.
---

# RedByte Frontend Surface Builder

Use this skill before changing RedByte UI source under `packages/rb-apps/src/apps/ide/**`, CSS surface rules, shell chrome, or browser gates.

## Startup

Read root `AGENTS.md`, the newest complete status sections in `AI_STATE.md` and `docs/ACTIVE_WORK.md`, and the relevant current contract. Use `docs/DOC_INDEX.md` on demand; search older history by topic. Consult the system map and conformance contract for work spanning surfaces.

## Product Direction

- Build the usable workbench, not a landing page.
- Make the current work object dominant and connect useful counterparts through the existing runtime owner. For signal inspection, use `redbyte-linked-representations`; do not create another simulator or selection authority.
- Avoid card walls, nested cards, persistent dead side space, duplicate status authorities, and decorative chrome that does not help a student act.
- Use existing RedByte primitives and CSS patterns before creating new component styles.
- Keep fixed-format controls dimensionally stable with explicit sizing, min/max constraints, and overflow handling.
- Use direct controls for direct actions: buttons, toggles, inputs, menus, sliders, and tabs. Do not make important labels look important but behave inertly.
- Keep text readable and contained at `1366x768` and `1440x900`; do not use negative letter spacing in newly touched rules.

## Boundaries

Do not change simulation, Verify semantics, pin mapping semantics, VHDL/XDC/testbench/Tcl/ZIP generation, project format, goldens, SaaS/accounts, or hardware proof claims unless the observed product defect directly requires it.

## Proof

Iterate in the running browser before expensive fixed-candidate checks. Reuse maintained gates and add focused regression proof where it protects real behavior. Identify the actual dirty build inputs and served candidate; HEAD alone cannot identify an uncommitted build. Follow root AGENTS required tiers: focused tests, relevant package/boundary checks, `verify:gates`, `build:unified`, and applicable docs/encoding checks. Broaden only for unresolved risk or new failures. Keep full logs locally and distinguish prior failures from regressions. Visual comprehension, interaction, correctness, deployment and physical proof are separate verdicts.
