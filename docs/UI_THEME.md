# Light Theme System

## Overview

RedByte OS now features a bright, welcoming Light theme as the default, with a seamless toggle between Light and Dark modes. The theme system ensures consistent styling across all components and surfaces while maintaining high contrast and readability in both modes.

## How Theme Works

### Theme Selection

**Default**: `light`

Users can toggle between `light` and `dark` themes using the sun/moon icon in the TopBar (right side, next to Log and Settings buttons).

### Theme Storage

The selected theme is persisted in `localStorage` under the key `rb-theme-variant`:
- **Key**: `rb-theme-variant`
- **Values**: `'light'` | `'dark'`
- **Persistence**: Across browser sessions

On app reload, the saved theme preference is restored automatically.

### No Flash of Wrong Theme

Theme is applied **before first paint** using JavaScript in the ThemeProvider component:

1. ThemeProvider reads saved theme from localStorage in state initialization
2. `applyTheme()` sets `data-theme` attribute on `<html>` element
3. CSS uses `[data-theme="light"]` and `:root` (default = dark) selectors
4. React `useEffect` syncs theme changes to DOM

This prevents the brief flicker of incorrect colors on page load.

---

## Token System

All visual properties are defined as CSS custom properties (tokens) in [packages/rb-apps/src/styles/os-tokens.css](../packages/rb-apps/src/styles/os-tokens.css).

### Dark Theme (Default Root)

The `:root` selector defines all tokens for dark mode (default):
```css
:root {
  --rb-bg-primary: #070B14;      /* Surface 0: darkest */
  --rb-text-primary: #E6EDF3;    /* White-ish text */
  --rb-accent: #D4930D;          /* Amber accent */
  --rb-border: #1B2028;          /* Subtle dark border */
  /* ... and 30+ more tokens */
}
```

### Light Theme

The `[data-theme="light"]` selector overrides all tokens for light mode:
```css
[data-theme="light"] {
  --rb-surface-0: #FAFAF8;       /* Warm white */
  --rb-text: #1C1917;            /* Nearly black */
  --rb-accent: #B47A09;          /* Darker amber */
  --rb-border: #E8E6E1;          /* Light gray border */
  --rb-shadow-1: 0 1px 2px rgba(0,0,0,0.06);  /* Softer shadows */
}
```

### Key Token Categories

| Token | Purpose | Light Value | Dark Value |
|-------|---------|-------------|-----------|
| `--rb-surface-0` | Main background | #FAFAF8 | #070B14 |
| `--rb-text` | Primary text | #1C1917 | #E6EDF3 |
| `--rb-accent` | Primary accent (actions) | #B47A09 | #D4930D |
| `--rb-border` | Subtle borders | #E8E6E1 | #1B2028 |
| `--rb-shadow-*` | Layering shadows | Light (0.06-0.10 opacity) | Dark (0.45-0.65 opacity) |

All tokens inherit through CSS custom property chain, ensuring consistency.

---

## Component Integration

### Using the Theme

To access or change the theme in React components:

```tsx
import { useTheme } from '@redbyte/rb-theme';

export const MyComponent = () => {
  const { variant, setVariant } = useTheme();
  
  return (
    <div>
      <p>Current theme: {variant}</p>
      <button onClick={() => setVariant(variant === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
    </div>
  );
};
```

### Theme Toggle

The TopBar (top-right corner) includes a sun/moon icon button that toggles between light and dark modes:

- **Light mode** → shows moon icon (click to switch to dark)
- **Dark mode** → shows sun icon (click to switch to light)

---

## CSS Animations & Polish

The light theme includes subtle, modern animations:

### Window Open Animation
```css
@keyframes rb-window-open {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.rb-shell-window {
  animation: rb-window-open 150ms var(--rb-easing-out);
}
```

Windows fade in and scale up smoothly when opening (150ms).

### Dock Hover
```css
.rb-dock:hover {
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}
```

Dock lifts slightly and casts a stronger shadow on hover.

### Soft Shadows (Light Mode)
In light theme, shadows are lighter and more subtle to maintain the airy feel:
```css
[data-theme="light"] .rb-shell-window {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
}
```

---

## Changing Defaults

To change the default theme or add a new variant:

### 1. Change Default Theme

Edit [packages/rb-theme/src/ThemeProvider.tsx](../packages/rb-theme/src/ThemeProvider.tsx):

```tsx
const [variant, setVariantState] = useState<ThemeVariant>(() => {
  if (typeof window === 'undefined') return 'light';  // ← Change here
  const saved = getActiveTheme();
  return saved ?? 'light';  // ← And here
});
```

Current default: `'light'`
Alternatives: `'dark'` | `'midnight'`

### 2. Add a New Theme Variant

1. Add new CSS selector in [packages/rb-apps/src/styles/os-tokens.css](../packages/rb-apps/src/styles/os-tokens.css):
   ```css
   [data-theme="myTheme"] {
     --rb-surface-0: #myColor;
     /* ... override all tokens for your theme */
   }
   ```

2. Add new variant type in [packages/rb-theme/src/applyTheme.ts](../packages/rb-theme/src/applyTheme.ts):
   ```tsx
   export type ThemeVariant = 'dark' | 'light' | 'midnight' | 'myTheme' | 'system';
   ```

3. Update `resolveThemeVariant()` function if needed for special handling (e.g., `'system'` respects OS preference).

### 3. Customize Token Values

Edit the specific theme section in os-tokens.css:

```css
[data-theme="light"] {
  --rb-surface-0: #FAFAF8;    /* ← adjust to suit your brand */
  --rb-text: #1C1917;         /* ← ensure contrast ratio ≥ 4.5:1 */
  --rb-accent: #B47A09;       /* ← maintain visual hierarchy */
}
```

**Best practice**: After changing tokens, run the brightness contract gate to validate:
```bash
pnpm test -- ui-dev-guards-contract-gate
```

---

## Accessibility & Contrast

Light theme maintains WCAG AA contrast ratios:
- **Text on background**: 14.5:1 (#1C1917 on #FAFAF8)
- **Accent on background**: 4.5:1+ (color-dependent)
- **Borders**: Subtle but distinguishable from background

The theme toggle respects user's system preference if not explicitly set.

---

## Files & Architecture

| File | Purpose |
|------|---------|
| [packages/rb-theme/src/ThemeProvider.tsx](../packages/rb-theme/src/ThemeProvider.tsx) | React context provider; manages theme state |
| [packages/rb-theme/src/applyTheme.ts](../packages/rb-theme/src/applyTheme.ts) | Core theme application logic; sets DOM attributes |
| [packages/rb-apps/src/styles/os-tokens.css](../packages/rb-apps/src/styles/os-tokens.css) | Single source of truth for all visual tokens |
| [packages/rb-shell/src/TopBar.tsx](../packages/rb-shell/src/TopBar.tsx) | Theme toggle UI button (sun/moon icon) |
| [packages/rb-shell/src/styles.css](../packages/rb-shell/src/styles.css) | Shell component animations & polish |
| [packages/rb-utils/src/__tests__/ui-dev-guards-contract-gate.test.ts](../packages/rb-utils/src/__tests__/ui-dev-guards-contract-gate.test.ts) | Brightness contract gate (validates theme implementation) |

---

## Verification

To verify the light theme is working correctly:

1. **Visual check**: Open http://localhost:5173/os/ and confirm:
   - Desktop loads with bright, welcoming appearance
   - Sun/moon icon visible in TopBar
   - Clicking icon toggles between light/dark
   - Windows open with smooth animation

2. **Programmatic check**:
   ```bash
   pnpm test -- ui-dev-guards-contract-gate
   ```
   All brightness contract assertions should pass:
   - ✓ ThemeProvider defaults to light
   - ✓ os-tokens.css defines light variables
   - ✓ TopBar has theme toggle
   - ✓ Window animations are present

3. **Documentation check**:
   ```bash
   pnpm demo:ready
   ```
   Must show ✅ DEMO READY (ensures theme system doesn't break export/determinism gates).

---

## Demo Day

The light theme delivers on the goal of making RedByte feel **bright, welcoming, and modern** on first load. No dark flash, smooth animations, and a quick toggle for user preference.

**Default**: Light mode
**Toggle**: TopBar sun/moon button
**Persistence**: Automatic across sessions
**Fallback**: System preference if available
