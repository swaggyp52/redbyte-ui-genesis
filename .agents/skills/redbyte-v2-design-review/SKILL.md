---
name: redbyte-v2-design-review
description: Use when reviewing or reshaping RedByte V2 UI surfaces, visual hierarchy, density, card walls, rails, color system, student trust, or engineering-IDE interaction quality.
---

# RedByte V2 Design Review

Use this skill when a RedByte surface feels unfinished, card-heavy, gimmicky, cramped, overly monochrome, or not trustworthy enough for students and professors.

## Required References

Read these before design decisions:

- `docs/product/RED_BYTE_STUDENT_UI_CONTRACT_V2.md`
- `docs/architecture/RED_BYTE_WORKSPACE_LAYOUT_V2.md`
- `docs/architecture/RED_BYTE_VISUAL_SYSTEM_V2.md`
- `docs/ide/SURFACE_CONFORMANCE.md`
- `.redbyte-brain/student-chrome-inventory.md`

## Review Lens

RedByte is an engineering IDE, not a SaaS landing page. Prioritize:

- direct manipulation and working controls over informational cards;
- one dominant work object per surface;
- quiet, industrial, deterministic visual language;
- compact but readable task density at `1366x768` and `1440x900`;
- plain student copy without raw hashes, E-tier jargon, or prototype labels;
- explicit diagnostics boundary for engineering metadata;
- accessible tabs, toolbars, dialogs, and grids.

## Anti-Patterns

Flag these as product defects:

- card walls where a real tool should exist;
- collapsible/generic side rails in normal student paths;
- raw build hashes or proof-tier language in normal chrome;
- expected/observed or PASS/FAIL copy that creates false authority;
- one-hue dark palettes with low hierarchy;
- empty lower viewport, nested cards, cropped controls, or mini-scroll traps.

## Proof

For any visual/product change, use browser proof with geometry and interaction assertions. Screenshots support judgment but do not replace gates. Do not weaken old gates unless the old gate protects a retired V1 structure and a V2 replacement exists.

## Eval Prompts

1. "Review Verify at 1366x768 and choose the highest-trust V2 design defect to fix."
2. "The Project page feels like cards of information, not a tool. Propose one contained V2 repair with a gate."
3. "Remove generic rail behavior from a surface without hiding useful controls or breaking keyboard access."

## Baseline Comparison

| Eval | No-skill / old-skill risk | Expected with this skill | Objective checks |
|---|---|---|---|
| Verify review | Picks spacing-only polish | Ranks trust, semantics, geometry, and actionability before choosing | before notes include ranked issues and chosen rationale |
| Project cards | Adds another prettier card | Converts passive info into direct workflow controls | gate asserts primary action and useful first viewport |
| Rail removal | Hides controls or leaves awkward sideways text | Replaces generic rails with surface-specific workspace regions | gate rejects generic rail controls and proves access to needed tools |
