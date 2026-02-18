# RedByte IDE Style Guide (Phase 1)

Status: v1 design token contract for `IdeApp`
Canonical companion: `docs/ide/ui-contract.md`

## Visual Direction

Tone: calm, high-contrast, engineering-focused.
Avoid: flat gray-on-gray and decorative chrome.

## Foundations

1. Grid and spacing
- 12-column main content grid within bounded container.
- 8px base rhythm only.
- Core spacing scale: 8, 16, 24, 32, 40, 48.

2. Typography
- UI font: `IBM Plex Sans`, fallback `Segoe UI`, sans-serif.
- Mono font: `IBM Plex Mono`, fallback `Consolas`, monospace.
- Size tiers:
1. Page title: 20-22px
2. Section headers: 14-16px
3. Body: 13-14px
4. Secondary/meta: 12px

3. Radius and depth
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

## UX Rules

1. Every mode has explicit empty/error/success states.
2. Every CTA maps to one deterministic action.
3. Avoid one-off style blocks inside mode components.
4. Mode markers (`data-testid`) are required for gates.
5. Every mode renders title row + action row + workspace + right inspector.
