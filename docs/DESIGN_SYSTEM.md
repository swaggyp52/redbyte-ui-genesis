# RedByte OS Genesis — Design System Reference

## Styling Architecture

RedByte uses a **hybrid multi-layer** approach:

| Layer | Technology | Scope |
|-------|-----------|-------|
| Tokens | CSS Custom Properties | Global design tokens via `rb-tokens` |
| Theme | `rb-theme` + `applyTheme.ts` | Dark (Neon) / Light (Frost) switching |
| Utilities | Tailwind CSS 3.4 | Inline utility classes |
| Modules | CSS Modules (`.module.css`) | Component-scoped styles |
| Controls | `os-controls.css` | Shared `.rb-*` control classes |

## Color Tokens

### Semantic Palette

| Token | Dark (Neon) | Light (Frost) | Usage |
|-------|-----------|-------------|-------|
| `--rb-accent` | `#22d3ee` (Cyan) | `#f59e0b` (Amber) | Primary interactive |
| `--rb-bg` | `#02040a` | `#f8fafc` | Root background |
| `--rb-panel` | `#050816` | `#ffffff` | Panel surface |
| `--rb-panel-2` | `#0f1a2d` | `#f1f5f9` | Elevated surface |
| `--rb-text` | `#e5e7eb` | `#1e293b` | Primary text |
| `--rb-muted` | `#94a3b8` | `#64748b` | Secondary text |
| `--rb-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Default border |

### Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Success | Emerald | `#10b981` / `#22c55e` |
| Warning | Amber | `#f59e0b` / `#fbbf24` |
| Error | Red | `#ef4444` |
| Info | Blue | `#3b82f6` |

### Surface Layers

```
--rb-surface-0  →  Base (deepest)
--rb-surface-1  →  Card / Panel
--rb-surface-2  →  Elevated (popover, modal)
--rb-surface-3  →  Topmost (tooltip, HUD)
```

## Typography

### Font Stacks

```css
/* Body */
font-family: "Space Grotesk", "IBM Plex Sans", "SF Pro Text", system-ui, sans-serif;

/* Code */
font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `xs` | 0.75rem (12px) | Labels, timestamps |
| `sm` | 0.875rem (14px) | Secondary text |
| `base` | 1rem (16px) | Body text |
| `lg` | 1.125rem (18px) | Section headers |
| `xl` | 1.25rem (20px) | Panel titles |

### Weight Convention

- **400 (normal)** — Body text
- **600 (semibold)** — Labels, stats
- **700 (bold)** — Section headers
- **900 (black)** — HUD badges, uppercase labels

## Spacing

RedByte uses an 4px base grid:

| Token | Value | Usage |
|-------|-------|-------|
| `--rb-pad-sm` | 10px | Compact padding |
| `--rb-pad-md` | 14px | Default padding |
| `--rb-pad-lg` | 18px | Generous padding |

Tailwind gap classes: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px).

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Base content | 0 | Default |
| Resize edges | 9 | Window resize handles |
| Resize corners | 10 | Window resize corners |
| Snap preview | 50 | Window snap overlays |
| Modals | 1000 | Dialogs, overlays |
| HUD | 9999 | TruthHUD, status overlays |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 2px | Badges, chips |
| `md` | 6px | Buttons, inputs |
| `lg` | 8px | Cards, panels |
| `2xl` | 16px | Modals |
| `full` | 9999px | Dots, avatars |

## Motion

| Token | Duration | Usage |
|-------|----------|-------|
| `--rb-motion-fast` | 150ms | Hover states |
| `--rb-motion-normal` | 250ms | Transitions |
| `--rb-motion-slow` | 400ms | Panel open/close |

Easing: `--rb-easing-out` = `cubic-bezier(0, 0, 0.2, 1)`

All animations respect `prefers-reduced-motion: reduce`.

## Control Classes (`os-controls.css`)

```css
.rb-panel        /* Styled panel with border + bg */
.rb-interactive  /* Button hover/active transitions */
.rb-input        /* Form input styling */
.rb-button-primary   /* Accent bg button */
.rb-button-secondary /* Subtle bg button */
.rb-button-ghost     /* Transparent bg button */
.rbEmptyState    /* Empty state container */
.rbButtonPrimary /* Inspector-style primary button */
```

## Theme Switching

```ts
import { applyTheme } from '@redbyte/rb-theme';

// Apply dark theme
applyTheme('redbyte-dark');

// Apply light theme
applyTheme('instrument');

// Persisted in localStorage under key 'rb-theme-variant'
```

## Key Source Files

| File | Purpose |
|------|---------|
| `packages/rb-tokens/src/tokens-dark.ts` | Dark theme token definitions |
| `packages/rb-tokens/src/tokens-light.ts` | Light theme token definitions |
| `packages/rb-theme/src/applyTheme.ts` | Theme application logic |
| `packages/rb-apps/src/styles/os-tokens.css` | CSS variable declarations |
| `packages/rb-apps/src/styles/os-controls.css` | Shared control classes |
| `packages/rb-shell/src/styles.css` | Shell-level animations |
| `src/global.css` | Global base styles |
