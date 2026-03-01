---
name: new-surface
description: Scaffold a new IDE surface following the established VerifySurface/DesignSurface pattern. Use when adding a new mode to the IDE.
disable-model-invocation: true
---

# New Surface Scaffolder

Creates a new IDE surface following the established pattern used by VerifySurface, DesignSurface, ImportSurface, etc.

## Usage

`/new-surface <SurfaceName>`

Example: `/new-surface AnalysisSurface`

## Steps

### 1. Create the surface file

Create `packages/rb-apps/src/apps/ide/surfaces/<SurfaceName>.tsx` with:

- Props interface matching the pattern: `interface <SurfaceName>Props { ... }`
- `displayStatus` state: `'IDLE' | 'RUNNING' | 'PASS' | 'FAIL'` (or whatever makes sense for this surface)
- Use only `IdeButton` (tones: `primary` | `secondary` | `ghost` | `danger`), `IdeCallout`, `IdeStatusPill`, `IdeDataTable` from `IdePrimitives.tsx`
- Export the component as default

### 2. Add the IdeMode variant

In `packages/rb-apps/src/apps/IdeApp.tsx`:
- Add the new mode name to the `IdeMode` type union (around line 50)
- Add a new `else if (mode === '<newMode>')` branch in the surface conditional chain (around line 770-950)
- Wrap the surface with `<ErrorBoundary>` matching the existing pattern
- Pass appropriate props from IdeApp state

### 3. Add left rail navigation (if needed)

In `packages/rb-apps/src/apps/ide/IdeLeftRail.tsx`:
- Add a rail button for the new mode following the zero-padded step pattern (e.g., `05`)

### 4. Write a unit test

Create `packages/rb-apps/src/apps/ide/surfaces/__tests__/<SurfaceName>.test.tsx` with:
- Render smoke test
- displayStatus rendering tests (idle, running, pass, fail states)
- Key button interaction tests

### 5. Verify

Run `pnpm --filter @redbyte/rb-apps test` and confirm the new test passes.
Run `pnpm typecheck` and confirm no type errors.

## Architecture Notes

- Layer E surfaces must not import directly from Layer A (rb-logic-core) — go through Layer B services
- All surfaces are wrapped in ErrorBoundary in IdeApp — do not wrap inside the surface itself
- `diagnosticRouteRequest` is cleared on design mutation — handle in IdeApp, not the surface
- CSS: append new styles to end of `ide-root.css`, use existing design tokens (`--rb-space-*`, `--rb-color-*`)
