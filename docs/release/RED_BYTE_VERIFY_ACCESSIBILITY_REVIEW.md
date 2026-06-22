---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: Verify V2 accessibility review for Product Trust Reset v2 Phase 3F
---

# RedByte Verify Accessibility Review

This review records the Phase 3F browser accessibility contract for the Verify V2 workbench on draft PR #78. Phase 3H adds the storage recovery accessibility guard for save/quota failure UI; see `docs/release/RED_BYTE_ASSISTIVE_TECH_REVIEW.md`.

## Reviewed Path

Browser path:

```text
Project -> Logic Gates starter -> Verify -> Course checks -> Duplicate to My checks -> Compare -> edit expected output -> rerun Compare
```

Viewports:

- `1366x768`
- Browser visual zoom check at 125 percent
- Reduced-motion media preference

## Accessibility Acceptance

The focused gates enforce:

- visible Verify buttons, selects, inputs, links, tabs, menu items, and role buttons have accessible names from text, `aria-label`, `aria-labelledby`, `title`, or placeholder text
- Course checks expose `data-provenance="course"` and `data-editable="false"`
- locked expected-output cells are disabled and explain the duplicate path
- `Duplicate to My checks` is keyboard focusable and activatable
- editable expected-output cells can be focused and changed using keyboard input
- the Run control can be focused and activated by keyboard
- Diagnostics opens as `role="dialog"` with `aria-modal="true"` and an accessible title
- core Verify controls remain visible at 125 percent visual zoom
- key Verify controls meet the Phase 3F browser-gate contrast floor

## Gate Commands

- `pnpm -s ide:gate:verify-accessibility-v2`
- `pnpm -s ide:gate:verify-keyboard-grid-v2`
- `pnpm -s ide:gate:verify-zoom-contrast-v2`
- `pnpm -s ide:gate:recovery-accessibility-v2`

These are browser gates, not a full third-party audit. They intentionally avoid adding a new dependency for Phase 3F.

## Current Limits

- This review does not certify full WCAG conformance.
- Screen-reader announcement quality still needs an actual assistive-technology pass before any screen-reader certification is claimed.
- The browser contrast gate uses computed CSS colors and a focused control set; it is a guardrail, not a comprehensive color audit.
- The keyboard gate covers the core expected-output edit/run loop, not every advanced Verify tool.

## Attribution

Connor Angiel
