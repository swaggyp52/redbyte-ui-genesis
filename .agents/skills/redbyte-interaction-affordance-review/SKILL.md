---
name: redbyte-interaction-affordance-review
description: Use when RedByte feels inert, labels should be editable/clickable, controls lack clear affordance, or workflows need browser-first interaction review.
---

# RedByte Interaction Affordance Review

Use this skill for complaints that the product is not interactive enough, important labels are inert, side panels feel awkward, or controls do not behave like users expect.

## Review Loop

1. Inspect the live app first at `1366x768` and `1440x900`.
2. Use fresh and dirty browser contexts when persistence, reload, or saved state is involved.
3. Rank issues by student impact, professor confidence, normal-use frequency, visual severity, contained fixability, and gateability.
4. Choose one defect only, then write the selected issue, alternatives rejected, out-of-scope items, likely files, and proof plan before editing.

## Affordance Checklist

- Can the visible object be clicked, double-clicked, keyboard-activated, cancelled, and saved when users expect it?
- Is there a visible hover/focus/pressed state?
- Are labels, editable identity, starter/lab source, and proof status visually distinct?
- Does Escape cancel, Enter commit, blur behavior match product intent, and reload/navigation preserve committed state?
- Are non-editable locations either clearly read-only or paired with a visible action?
- Does the control still work after loading a starter, opening saved work, switching surfaces, and reloading?

## Gate Requirements

Focused browser gates should use real user behavior plus assertions for visibility, copy, state agreement, persistence, navigation/reload recovery, and console/page errors. Do not weaken an existing gate to make the interaction pass.
