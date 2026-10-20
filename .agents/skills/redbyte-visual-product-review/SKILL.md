---
name: redbyte-visual-product-review
description: Use when reviewing RedByte visual quality, product direction, first-viewport hierarchy, density, typography, and surface-level credibility from real browser evidence.
---

# RedByte Visual Product Review

## Required Inputs

1. Read the current cockpit docs and the relevant surface specs before reviewing.
2. Launch the app and inspect real browser states, not component assumptions.
3. Inspect `1366x768`, `1440x900`, and a narrow/short viewport; use other sizes when the task requires them. Include ordinary saved panel preferences.
4. Include one clean-start path and one dirty or resumed project state when possible.

## Review Axes

- First-viewport focal object: the user should immediately know what matters.
- Workflow clarity: Project -> Design -> Simulate -> Board -> Package should feel deliberate.
- Comprehension: can the student follow the same circuit object and moment between representations, enter an instance, understand a local rule, and recover the overview?
- Temporal clarity: distinguish sampled time, logical evaluation order and physical timing. Inspect pause, step, keyboard operation and reduced motion.
- Correspondence: labels remain readable; selection and values agree across views without camera jumps or false exact HDL mappings.
- Density: dense is acceptable for an engineering workbench; cramped, duplicated, or card-heavy is not.
- Typography: surface titles, evidence labels, and primary commands need a clear hierarchy.
- Visual language: RedByte should feel like a serious course lab workbench, not generic SaaS, a toy simulator, or decorative cyberpunk.
- Trust language: proof, draft, stale, ready, Vivado, and hardware claims must map to real evidence tiers.

## Output Shape

Write findings with:

- observed surface and viewport
- screenshot or artifact path
- severity
- likely source files
- what to standardize, remove, emphasize, demote, or leave alone
- proof required before claiming the issue is fixed

Separate visual direction from functional correctness. A surface can be behaviorally correct and still visually weak.
