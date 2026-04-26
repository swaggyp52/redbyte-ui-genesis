---
doc_status: current
last_validated: 2026-04-21
owner: Connor Angiel
used_by_claude: true
role: design tokens + component catalog
---

# RedByte IDE Style Guide (Phase 1)

Status: v1 design token contract for `IdeApp`
Canonical companion: `docs/ide/ui-contract.md`
Frozen system spec: `docs/ide/design-system-v1.md`

## Visual Direction

Tone: calm, high-contrast, engineering-focused.
Avoid: flat gray-on-gray and decorative chrome.

## Foundations

1. Grid and spacing
- 12-column main content grid within bounded container.
- 8px rhythm with explicit micro-step support only where specified.
- Allowed spacing scale: 4, 8, 12, 16, 24, 32, 40, 48.
- No ad-hoc spacing values outside this scale.

2. Shell dimensions (fixed)
- Top bar: 56px.
- Left rail: 72px.
- Mode header row inside each surface: 48px.
- Status bar: 32px.
- Design canvas region fills remaining workspace height and keeps overflow clipped.

3. Typography
- UI font: `IBM Plex Sans`, fallback `Segoe UI`, sans-serif.
- Mono font: `IBM Plex Mono`, fallback `Consolas`, monospace.
- Size tiers:
1. Page title: 20-22px
2. Section headers: 14-16px
3. Body: 13-14px
4. Secondary/meta: 12px

4. Radius and depth
- Radius: 8px default, 12px large containers.
- Shadow: one soft elevation level for cards/panels.

## Color Tokens

Use CSS custom properties and never hardcode in components.

1. Surfaces
- `--ide-bg`: app background
- `--ide-surface-1`: primary panel
- `--ide-surface-2`: secondary panel
- `--ide-surface-3`: raised panel

2. Text
- `--ide-text-strong`
- `--ide-text-muted`
- `--ide-text-soft`

3. Semantics
- `--ide-accent`: primary action
- `--ide-accent-2`: secondary highlight
- `--ide-success`
- `--ide-warning`
- `--ide-danger`
- `--ide-border`

## Shared Components

1. `Card`
- For summary and status blocks.

2. `Panel`
- For left/right containers and table wrappers.

3. `Button`
- Variants: `primary`, `secondary`, `ghost`, `danger`.

4. `StatusPill`
- States: `idle`, `ok`, `warn`, `error`.

5. `Callout`
- Inline explanatory or warning blocks.

6. `EmptyState`
- Heading, body text, primary CTA, optional secondary.

7. `InspectorSection`
- Title + body with consistent spacing.

8. `DataTable`
- Deterministic row styling with sticky header support.

9. `Chip`
- Compact semantic tags for example metadata and status context.

10. `Modal`
- Blocking confirmation for destructive actions (for example, replacing active workspace with a starter example).

## UX Rules

1. Every mode has explicit empty/error/success states.
2. Every CTA maps to one deterministic action.
3. Avoid one-off style blocks inside mode components.
4. Mode markers (`data-testid`) are required for gates.
5. Every mode renders title row + action row + workspace + right inspector.
