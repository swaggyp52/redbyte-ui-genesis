# RedByte OS Genesis — UI Style Guide

**Canonical Token Source:** `packages/rb-shell/src/styles.css` (lines marked with `RB_CORE_TOKENS_START` / `RB_CORE_TOKENS_END`)

## Core UI Token Contract

All shell UI surfaces must use these canonical tokens. **Do not add raw colors; use tokens.**

### Token List (20/20)

| Token | Purpose | Example Use |
|-------|---------|------------|
| `--rb-ui-bg` | Primary background (shell, desktop) | Shell container, app backgrounds |
| `--rb-ui-surface-1` | Raised surface (panels, modals base) | Taskbar, dropdown menus, panel backgrounds |
| `--rb-ui-surface-2` | Secondary raised (hover, focus states) | Hover buttons, active tabs, panel headers |
| `--rb-ui-surface-3` | Tertiary raised (inactive, nested) | Disabled states, secondary panels, nested elements |
| `--rb-ui-text` | Primary text | Headers, main content, labels |
| `--rb-ui-text-2` | Secondary text | Sublabels, descriptions, faded text |
| `--rb-ui-text-3` | Tertiary text | Muted text, timestamps, disabled labels |
| `--rb-ui-border` | Standard border | Panel edges, dividers, input borders |
| `--rb-ui-border-strong` | Emphasis border | Focused inputs, active edges, critical dividers |
| `--rb-ui-accent` | Action color (primary) | Buttons, focus rings, indicators, links |
| `--rb-ui-accent-soft` | Subtle accent (hover, feedback) | Soft highlights, hover states, resize handles |
| `--rb-ui-danger` | Error/destructive state | Error messages, dangerous buttons, warnings |
| `--rb-ui-radius-sm` | Small border radius | Buttons, small UI, focus rings |
| `--rb-ui-radius-md` | Medium border radius | Cards, panels, modals, larger components |
| `--rb-ui-shadow-2` | Subtle shadow | Tooltips, floating elements, layer depth |
| `--rb-ui-shadow-3` | Strong shadow | Modals, overlays, prominent elevation |
| `--rb-ui-motion-fast` | Quick animation duration | Micro-interactions, hovers, state changes |
| `--rb-ui-ease-out` | Easing function | Animations, transitions, motion curves |
| `--rb-ui-font-sans` | Sans-serif font family | UI text, labels, most copy |
| `--rb-ui-font-mono` | Monospace font family | Code, addresses, technical text |

## Normalized Surfaces (P5B-1)

The following 10+ UI surfaces have been normalized to use canonical tokens:

1. **Shell Container** (`packages/rb-shell/src/styles.css`) — Background, text, accent colors
2. **BootScreen** (`packages/rb-shell/src/BootScreen.{tsx,js}`) — Boot animation, surfaces, transitions
3. **Dock** (`packages/rb-shell/src/Dock.{tsx,js}`) — Dock background, items, transitions, shadows
4. **CommandPalette** (`packages/rb-shell/src/CommandPalette.{tsx,js}`) — Palette background, borders, shadows
5. **Taskbar** (`packages/rb-shell/src/styles.css`) — Taskbar background, items, launcher, tooltips
6. **WindowShell** (`packages/rb-shell/src/WindowShell.{tsx,js}`) — Window chrome, titlebar, borders
7. **Taskbar / Icon Surfaces** (via global styles) — Icons, hover states, dividers
8. **PipelinePanel** (`packages/rb-shell/src/PipelinePanel.{tsx,js}`) — Panel background, borders, text
9. **HomeScreen** (`packages/rb-shell/src/HomeScreen.tsx`) — Dialog background, sections, buttons, chips
10. **ProgressToasts** (`packages/rb-shell/src/ProgressToasts.tsx`) — Toast library integration

## Rules

- **No hardcoded colors in component styles.** All color references must map to canonical tokens.
- **No layout changes during normalization.** Token swaps only.
- **Typography tokens (`--rb-ui-font-*`) are semantic.** Use for distinguishing sans vs. mono, not for size/weight variants.
- **Motion tokens (`--rb-ui-motion-fast`, `--rb-ui-ease-out`) ensure consistency.** Apply to all transitions/animations.
- **Token names are immutable in this contract.** Changing token names requires gate re-validation.

## Referencing This Guide

When adding a new surface or component, consult this token list. If a use case is missing, propose a new semantic token here and in the canonical CSS block before implementation.

---

**P5B-1 Completion Date:** 2026-02-06  
**Canonical Token Count:** 20 (target: ≤ 20)  
**Deterministic Gate:** `ui:style-token-contract-gate` (package.json script)
