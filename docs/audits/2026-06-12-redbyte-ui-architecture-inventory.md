---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: UI architecture and styling inventory for visual hardening
---

# RedByte UI Architecture Inventory - 2026-06-12

## Purpose

This inventory identifies the UI architecture pressure points that affect RedByte visual consistency and future product hardening. It is evidence for a design-system cleanup slice, not an instruction to rewrite surfaces wholesale.

## Current Shell And Surface Map

Primary IDE shell and layout components:

- `packages/rb-apps/src/apps/ide/components/IdeTopBar.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeLeftRail.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeStatusBar.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx`
- `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`

Primary surfaces:

| Surface | File | Approx lines |
|---|---:|---:|
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | 8384 |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | 6559 |
| Import | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | 4131 |
| Hardware / Map Pins | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | 3392 |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | 2682 |
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | 1847 |

Shared or semi-shared primitives:

- `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/components/SurfaceLayoutPrimitives.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/project/ProjectSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifySurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/hardware/HardwareSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/export/ExportSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/components/Basys3BoardView.tsx`
- `packages/rb-apps/src/apps/ide/components/HardwareBoard2D.tsx`

## Styling Inventory

| File or pattern | Current count / size | Risk |
|---|---:|---|
| `packages/rb-apps/src/apps/ide/ide-root.css` | 29290 lines | Too much global surface styling in one file; hard to reason about cascade and dead styles |
| `packages/rb-apps/src/apps/ide/ide-polish-pass.css` | 2531 lines | Overlay polish file can hide source-of-truth token and layout decisions |
| Inline `style={{ ... }}` in IDE TSX | 259 matches | Repeated one-off layout and color decisions bypass shared classes/tokens |
| `className=`, `style=`, or `data-testid` matches in IDE surfaces/components | 4147 matches | High surface-specific hook density; useful for tests but also signals fragmented UI composition |
| Raw hex colors in IDE TS/TSX/CSS | many matches | Tokens exist, but raw color usage still appears in metadata, SVGs, and styling |

Token families observed:

- `--rb-*`
- `--rbp-*`
- component-local CSS variables
- raw hex and rgba values in TSX/SVG/CSS

The parallel token families are not automatically wrong, but they raise the cost of visual hardening because a surface can look correct while bypassing the intended shared system.

## Duplication Patterns

The same product concepts appear through different local patterns:

- workflow/stage rail state
- pass/fail/stale/draft/ready/trusted chips
- card and panel headings
- primary action buttons
- evidence rows and small metrics
- empty-state hero blocks
- side notes and support docks
- board/resource chips
- waveform/proof status labels

These should become shared primitives before deeper visual work, otherwise each surface will keep drifting.

## Surface Complexity Risks

Design and Verify are large enough that visual cleanup inside them can accidentally touch behavior. Any hardening slice should avoid mixing:

- circuit graph semantics
- simulator state
- Verify vector state
- export readiness logic
- project persistence
- layout and visual hierarchy

The safest sequence is to extract or standardize visual primitives first, then apply them surface by surface with focused browser gates.

## Likely Refactor Targets

### Shared Visual Primitives

- `RedBytePanel`
- `RedByteSectionHeader`
- `RedByteStateChip`
- `RedBytePrimaryAction`
- `RedByteEvidenceRow`
- `RedByteWorkflowRail`
- `RedByteEmptyState`
- `RedByteArtifactList`

Names are placeholders. The point is to consolidate behavior-free visual patterns, not invent a new framework.

### Token Cleanup

- Define which token family is authoritative for IDE surfaces.
- Replace raw color values in surface chrome with named tokens.
- Keep domain colors for signal/wire/board affordances, but isolate them from layout chrome.
- Normalize spacing and border radii for panels, cards, rows, and buttons.

### CSS Cleanup

Do not rewrite `ide-root.css` in one pass. Instead:

1. identify a small repeated pattern
2. create or update a shared primitive
3. migrate one or two surfaces
4. run focused browser proof
5. remove dead or duplicate CSS only when no longer referenced

## Do Not Do Yet

- Do not redesign all surfaces in one commit.
- Do not introduce a new styling framework.
- Do not replace working test IDs as part of visual cleanup.
- Do not change Verify, export, VHDL, XDC, or project state semantics while cleaning layout.
- Do not make Vivado or hardware claims from visual refactors.

## Recommended First Architecture Slice

Create a shared visual primitive cleanup for panel/card/chip/action patterns, then migrate Project and Export as low-risk surfaces before touching Design, Verify, or Hardware. Add browser geometry checks around the first viewport for every migrated surface.
