# RedByte UI Constitution

RedByte OS is a deterministic instrument. Every surface must express traceable state, stable interaction rules, and explicit provenance.

## Core Philosophy
- Determinism is the product. Every action emits a logged state transition.
- The UI is an instrument panel, not a website.
- Consistency beats novelty. All interaction rules are predictable and reversible.

## Design Tokens
Tokens are the single source of truth. Use CSS variables and shared token packages.

### Color
- Backgrounds: `--rb-bg`, `--rb-panel`, `--rb-panel-2`
- Borders: `--rb-border`, `--rb-border-strong`
- Text: `--rb-text`, `--rb-muted`, `--rb-faint`
- Accents: `--rb-accent`, `--rb-accent-weak`, `--rb-accent-strong`
- Status: `--rb-warn-bg`, `--rb-warn-border`, `--rb-danger-bg`, `--rb-danger-border`

### Spacing
- `--rb-pad-sm` = 8-10px (density-aware)
- `--rb-pad-md` = 12-14px
- `--rb-pad-lg` = 14-18px
- Use 4px baseline increments only.

### Radii
- `--rb-radius-sm` for controls
- `--rb-radius-md` for panels
- `--rb-radius-lg` for windows and modals

### Typography
- Body: `--rb-font-family-body`
- UI labels: same family with medium weight
- System data: `--rb-font-mono`
- Case: uppercase for system statuses and modes only

### Shadows
- Use `--rb-shadow-sm` for controls, `--rb-shadow-md` for panels
- Glow allowed only via `--rb-effect-glow` on key focus or recording states

### Motion
- Duration: 150ms (fast), 250ms (default), 400ms (slow)
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
- No bounce. Respect reduced motion setting and `prefers-reduced-motion`.

## Component Rules

### Buttons
- Primary uses `--rb-accent` background with clear hover and focus ring.
- Icon buttons use 16px icons; tool buttons use 20px; primary tool icons use 24px.
- Disabled states reduce opacity and remove hover glow.

### Inputs
- 1px border using `--rb-border`.
- Focus ring uses `--rb-accent-strong`.
- Monospace inputs for code, IDs, and system data.

### Tabs
- Tabs always show active state with top/bottom bar and bold label.
- No hidden tabs. If overflow, allow scroll or collapse into menu.

### Panes
- Panes are bordered, labeled, and display provenance when applicable.
- Headers are 32-40px tall; content uses density tokens.

### Modals
- Centered or docked; no full-screen unless task requires it.
- Always include provenance footer and close affordance.

### Notifications
- Toasts auto-dismiss and must remove hitboxes on dismiss.
- Errors are duplicated in the System Log.

### Windows
- Window chrome is consistent: header, body, provenance footer.
- Buttons order and iconography are fixed across apps.

## Icon System
- Use `@redbyte/rb-icons` only.
- Use IconMap registry (`Icon` with semantic names).
- Sizes allowed: 16, 20, 24 only.
- Icons are semantic, never decorative.

## Layout Rules
- Top bar is always visible and contains: launcher, determinism status, system log, settings.
- Dock sits above TruthBar and aligns to a fixed grid.
- Windows follow the OS contract for focus, z-index, and snapping.
- Desktop icons align to a grid; no random placement.

## Determinism Rules
- Every command, intent, or state change emits a System Log entry.
- Recording state is visible in the top bar and in the determinism panel.
- Every window shows provenance: app ID, resource ID (if any), last event tick.
- Exports include event stream, UI state snapshot, version, and hash.
- Errors are never hidden; they are logged and surfaced.

## Accessibility + Input
- Keyboard navigation is first-class: Tab, arrows, and OS shortcuts.
- Focus indicators must be visible on all interactive elements.
- Motion reduction is honored globally.
