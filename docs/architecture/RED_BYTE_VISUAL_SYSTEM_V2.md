---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 visual system contract
---

# RedByte Visual System V2

This contract defines the visual direction for Product Trust Reset v2. It supersedes the one-color, glow-heavy, card-first V1 appearance for new V2 surfaces.

Do not merely recolor the existing boxes. V2 changes structure first, then color.

## Goals

- Trustworthy
- Deterministic
- Dense but readable
- Tool-like
- Basys3 lab specific
- WCAG-aware
- Calm under repeated classroom use

## Palette

Application shell:

- neutral charcoal/slate
- low-saturation borders
- no decorative gradients
- no glow as a primary hierarchy device

Work surfaces:

- slightly lighter or darker than shell
- clear separation between canvas, table, waveform, preview, and command regions
- minimal elevation

Mode accents:

- Design: blue/cyan
- Verify: violet/indigo
- Hardware: amber
- Export/success: green
- Warning: amber
- Failure: red

Use accents sparingly. A surface should not become a single-hue theme.

## Typography

- UI text should be compact and readable.
- Headings inside workbenches are functional labels, not hero type.
- Monospace is for signals, pins, file names, hashes inside Diagnostics, and code preview.
- Letter spacing should stay at `0` unless a small all-caps label already exists and is readable.

## Surface Levels

- Shell: navigation and global context.
- Workspace: the work object.
- Toolbar: direct actions for the work object.
- Context bar: selected-object properties or current run/check state.
- Support detail: secondary evidence, guidance, or diagnostics.

Cards are not a surface level. Use them only for discrete choices or self-contained actionable items.

## Interaction Styling

- Buttons must look like actions, not badges.
- Selectable rows must have clear selected, hover, focus, and disabled states.
- Tabs must look like mutually exclusive workspace modes.
- Tables and file trees should use row density and alignment rather than box nesting.
- Toggles, segmented controls, sliders, and icons should match the control type.
- Keyboard focus must remain visible.

## V2 CSS Direction

- Introduce a small V2 token layer.
- Prefer semantic class groups or CSS modules for V2 primitives.
- Do not add more unrelated overrides to `ide-root.css` or `ide-polish-pass.css` unless a temporary bridge is unavoidable.
- Keep old global styles scoped to old surfaces until removed.

## Acceptance

Screenshots at `1366x768`, `1440x900`, and `1920x1080` must show:

- no raw build/proof/internal chrome in normal student UI
- no generic side rails required for desktop use
- no oversized card stacks acting as the page structure
- clear mode differentiation without monochrome wash
- first-viewport primary work object
- no cropped controls or text
- no unexplained passive panels
