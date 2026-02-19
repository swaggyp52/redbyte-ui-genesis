# RedByte IDE Design System v1.0

Status: Frozen contract for visual authority and implementation consistency.
Scope: IDE and public-facing launch surfaces.

## Core Principle

Visual quality is a correctness signal. Every screen must feel deterministic, intentional, and calm.

## Token Contract

1. Spacing
- Allowed spacing values: 4, 8, 12, 16, 24, 32, 48, 64.
- All component padding/gaps/margins must use token values only.

2. Typography
- Size scale: 12, 13, 14, 16, 18, 24.
- Line-height scale: 16, 18, 20, 24, 32.
- Weights: 400, 500, 600.
- Fonts:
  - UI: `IBM Plex Sans`
  - Mono: `IBM Plex Mono`

3. Surface + Elevation
- Surface levels:
  - Base background
  - Surface-1 (primary panels)
  - Surface-2 (secondary/raised)
- Elevations:
  - `--rb-elevation-0`
  - `--rb-elevation-1`
  - `--rb-elevation-2`

4. Motion
- Timing:
  - Fast: 120ms
  - Normal: 180ms
  - Slow: 260ms
- Easing:
  - Standard: `cubic-bezier(0.2, 0, 0, 1)`
  - Emphasis: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Motion should support comprehension, never decoration.

5. Radii
- Allowed radii: 8, 12, 16.

## Layout Contract

1. Shell dimensions
- Top bar: 56px
- Left rail: 72px
- Mode header row: 48px
- Status bar: 32px

2. Grid
- Desktop main content: 12 columns.
- Right inspector width: min 320px, max 420px.
- Mobile collapse: 1-column.

3. Density
- No mode may render an empty full-screen void.
- Every mode must render:
  - Surface header
  - Primary action
  - Main content panel
  - Secondary panel/inspector

## Interaction Contract

1. Feedback style
- Use short diagnostics with code + action.
- Avoid long explanatory prose.

2. State handling
- Empty states provide one next action.
- Blocking states provide direct fix path.
- Success states provide deterministic evidence (hash/status).

## Public Launch Surface Contract

1. Hero headline:
- `Deterministic FPGA Design. Visual. Verifiable. Exportable.`

2. 30-second flow strip:
- Design -> Verify -> Export

3. CTA structure:
- Primary: Launch IDE
- Secondary: View diagnostics
- Tertiary: Open example workspace

## Verification

1. Static contract gate
- `ide:gate:design-system-contract`

2. Runtime visual/layout gates
- `ide:gate:visual-contract`
- `ide:gate:primary-cta-contract`
- `ide:gate:examples-contract`
