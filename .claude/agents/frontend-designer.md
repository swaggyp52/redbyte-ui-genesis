# frontend-designer agent

## Domain Ownership
This agent owns the visual design system: CSS tokens, layout, animations, typography, and cross-surface visual consistency for the RedByte IDE.

## Primary Files
- `packages/rb-apps/src/apps/ide/ide-root.css` — main IDE stylesheet (~8000+ lines)
- `packages/rb-theme/src/` — design token definitions (CSS custom properties)
- `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` — `IdeButton`, `IdeCallout`, `IdeStatusPill`, `IdePanel`, `IdeDataTable`, `IdeModal`, `IdeInspectorAccordion`, `IdeInspectorSection`
- `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx` — shell layout: dock + inspector + console + main panel
- `packages/rb-apps/src/apps/ide/components/SurfaceLayoutPrimitives.tsx` — `SurfacePanel`

## Design Language
**Dark PCB aesthetic:**
- Background: near-black `#030810` / `#050b14` / `#080f1a`
- Accent 1 (teal/aqua): `#2ec4b6` / `rgba(46,196,182,...)` — live signals, selection
- Accent 2 (amber): `rgba(251,191,36,...)` — cursor A, warnings
- Accent 3 (red): `rgba(255,98,98,...)` / `rgba(248,113,113,...)` — failures, cursor B
- Text primary: `rgba(200,220,255,0.85)` — headings
- Text soft: `rgba(140,160,200,0.55)` — captions, secondary

## CSS Custom Properties (Token Reference)
```css
--ide-text           /* primary text color */
--ide-text-soft      /* secondary/muted text */
--ide-border         /* subtle border */
--ide-bg             /* surface background */
--ide-bg-raised      /* elevated panel bg */
--ide-space-1        /* 4px */
--ide-space-2        /* 8px */
--ide-space-3        /* 12px */
--ide-space-4        /* 16px */
--ide-font-size-1    /* small text ~11px */
--rb-color-ok        /* green: pass/success */
--rb-color-warn      /* amber: warning */
--rb-color-error     /* red: failure */
--rb-color-info      /* blue: informational */
```

## IdeButton Tones
| tone | Appearance | Use case |
|------|-----------|----------|
| `primary` | Teal fill | Main CTA, pulsing when actionable |
| `secondary` | Outlined teal | Secondary action |
| `ghost` | Text only, dim | Tertiary/utility |
| `danger` | Red fill | Destructive action |

## IdeCallout Tones
| tone | Appearance | Use case |
|------|-----------|----------|
| `info` | Blue-tinted | Informational, onboarding tips |
| `warn` | Amber-tinted | Non-blocking warnings |
| `error` | Red-tinted | Blocking errors |
| `success` | Green-tinted | Success confirmation |
**NOTE**: `"ok"` is NOT a valid IdeCallout tone. Use `"success"` instead.

## IdeStatusPill Tones
Valid tones: `ok`, `warn`, `error`, `idle`. These differ from IdeCallout tones.

## Layout Grid
DesignSurface, VerifySurface, ProjectSurface etc. use `IdeSurfaceLayout`:
```
[dock (left sidebar)] [main panel] [inspector (right sidebar)]
                      [console (bottom drawer)]
```
- Dock: 220px fixed, scrollable
- Inspector: 280px fixed, scrollable
- Console: collapsible bottom, ~200px open

## Waveform/Oscilloscope Visual System
WaveformViewer is an SVG component inside VerifySurface.tsx:
- Background: `#030810` (dark PCB)
- Grid lines: `rgba(56,189,248,0.04)` minor / `rgba(56,189,248,0.12)` major
- Signal HIGH rail: `#2ec4b6` (teal, fully opaque)
- Signal LOW rail: `rgba(46,196,182,0.65)` (teal, 65% — recently fixed from 35%)
- Fail column overlay: `rgba(255,85,85,0.07)` background + `rgba(255,98,98,0.92)` markers
- Selected tick: `rgba(56,189,248,0.18)` column highlight + `rgba(56,189,248,0.9)` cursor
- Cursor A: `rgba(251,191,36,0.95)` amber
- Cursor B: `rgba(248,113,113,0.92)` red
- Label area: 88px fixed left column

## Common CSS Class Patterns
- `.ide-verify-*` — Verify surface specific
- `.ide-design-*` — Design surface specific
- `.ide-hardware-*` — Hardware surface specific
- `.ide-export-*` — Export surface specific
- `.ide-project-*` — Project surface specific
- `.ide-signal-*` — signal list items (dock)
- `.ide-kv-*` — key-value pair rows
- `.ide-inline-actions` — horizontal action button groups

## Visual Consistency Checklist
When auditing surfaces for consistency:
1. Headings use `<h3>` inside `.ide-design-subheader` (flex row with label + meta)
2. Empty states use `.ide-empty-stack` with `.ide-verify-empty-message` pattern
3. Action groups use `.ide-inline-actions` (flex gap)
4. Code values use `<code>` tags
5. Copy/body text uses `.ide-copy` class
6. Status indicators use `IdeStatusPill` not raw CSS colors
7. All inputs use `.ide-export-pin-input` classes for consistent field styling

## Animation Tokens
- `--ide-transition-fast: 120ms ease`
- `--ide-transition-base: 200ms ease`
- Pulsing CTAs use keyframe `ide-pulse-glow`
- Waveform scan line uses `ide-scan-line-sweep`

## Common Tasks
- **Fix opacity/visibility**: Search for `rgba(...)` patterns in the relevant surface section of ide-root.css
- **Fix layout gap**: Check IdeSurfaceLayout props — `dock`, `inspector`, `console`, children
- **Add new callout**: Use `<IdeCallout tone="info|warn|error|success">` from IdePrimitives
- **Fix button sizing**: Check `.ide-btn` size variants (sm/default/lg) in IdePrimitives styles
- **Dark PCB panel**: Use `.ide-surface-panel` or `<SurfacePanel>` wrapper
- **Typography fix**: Check `--ide-font-size-1` / `--ide-font-size-2` usage in target section
