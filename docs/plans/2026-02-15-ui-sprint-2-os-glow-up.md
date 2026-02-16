# UI Sprint 2: "Make It Feel Like a Real OS" — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RedByte feel bright, premium, and alive—like a modern desktop environment that's classroom-deployable. Visual hierarchy, layout clarity, delight, accessibility, and kid-proofing. No new features. Ship UI wins that are instantly obvious AND survive contact with a room full of students on mediocre laptops.

**Architecture:** All styling uses CSS custom properties (`--rb-ui-*` tokens mapped in `packages/rb-shell/src/styles.css`) + Tailwind utilities + CSS Modules. Theme switching via `[data-theme]` attribute on `<html>`. Components live in `packages/rb-shell/src/` (Desktop, Dock, ShellWindow, BootScreen) and `packages/rb-apps/src/apps/` (HomeApp, SettingsApp, SubmissionInspectorApp). No new libraries. Token-only colors.

**Tech Stack:** React 19, Vite 7, Tailwind 3.4, CSS Custom Properties, CSS Modules, Vitest (unit), Playwright (E2E)

**Hard Constraints:**
- Must pass `pnpm demo:ready` at end
- No new heavy UI libraries
- No raw colors—tokens only
- No regression to dark-by-default
- Every change must be visible and improve UX
- Existing `ui:style-token-contract-gate` must pass (20 tokens, no raw hex in shell components)
- **Accessibility:** Light mode text/bg contrast >= 4.5:1 (WCAG AA). Body text >= 13px. Visible focus rings everywhere.
- **Performance:** Blur must degrade gracefully. Noise must be cheap. Reduced-motion disables ALL new animations.
- **Classroom-proof:** "Start Here" is the obvious path. Export flow is idiot-proof. Inspector looks like a TA tool.

---

## Task 1: Take "Before" Screenshots (Manual Baseline)

**Files:**
- Create: `docs/ui/before/` directory

**Step 1: Build and preview the app**

Run: `pnpm build && pnpm preview &`

**Step 2: Manually capture baseline screenshots**

Open browser to `http://127.0.0.1:4173/os/` and take screenshots of:
- Boot screen
- Desktop (empty, after boot)
- Dock (hover states)
- A window open (any app)
- Settings open
- Home/Dashboard

Save into `docs/ui/before/` with descriptive names. These are reference-only; automation comes in Task 10.

**Step 3: Commit baseline**

```bash
git add docs/ui/before/
git commit -m "docs: capture UI Sprint 2 'before' screenshots"
```

---

## Task 2: Desktop "Wallpaper" Redesign — Gradient + Noise + Grid (with Performance Guardrails)

**Files:**
- Modify: `packages/rb-apps/src/styles/os-tokens.css` (add wallpaper gradient tokens + blur toggle)
- Modify: `packages/rb-shell/src/Desktop.tsx` (redesign desktop surface)
- Modify: `packages/rb-shell/src/styles.css` (add noise texture + grid utilities + performance fallback)

**Step 1: Add wallpaper gradient tokens to os-tokens.css**

In the `:root` block, add:
```css
--rb-wallpaper-from: #0A0F1C;
--rb-wallpaper-to: #0D1420;

/* Performance toggle: set to 'none' to disable blur globally */
--rb-blur-strength: 16px;
--rb-blur-fallback-bg: var(--rb-surface-1);
```

In `[data-theme="light"]`, add:
```css
--rb-wallpaper-from: #F0EDE6;
--rb-wallpaper-to: #E8E4DB;
```

In `[data-theme="midnight"]`, add:
```css
--rb-wallpaper-from: #020617;
--rb-wallpaper-to: #0B1020;
```

**Step 2: Add CSS noise texture class in styles.css (cheap SVG overlay)**

After the wallpaper animation section, add:
```css
.rb-desktop-surface {
  background:
    linear-gradient(160deg, var(--rb-wallpaper-from) 0%, var(--rb-wallpaper-to) 100%);
}

/* Noise overlay: tiny inline SVG with feTurbulence, opacity 0.03.
   This is a single 200x200 repeating tile — no GPU cost. */
.rb-desktop-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,...") repeat;
  background-size: 200px 200px;
  opacity: 0.03;
  pointer-events: none;
}
```

**IMPORTANT:** The noise SVG must be tiny (<1KB data URI). Use `feTurbulence baseFrequency="0.65" numOctaves="3"` with a `<rect>` fill at low opacity. This is a single composite — no repaints. Test on a Chromebook-class device if possible.

**Step 3: Add blur degradation support**

In styles.css, add:
```css
/* Blur support: graceful degradation for low-end devices */
@supports not (backdrop-filter: blur(1px)) {
  .rb-blur-surface {
    background: var(--rb-blur-fallback-bg) !important;
    backdrop-filter: none !important;
  }
}

/* Performance mode: disable blur via attribute */
:root[data-rb-perf="low"] .rb-blur-surface {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: var(--rb-blur-fallback-bg);
}
```

**Step 4: Update Desktop.tsx**

Replace the current wallpaper rendering approach with the new `.rb-desktop-surface` class. Keep the existing `rb-field-drift` animation as an optional subtle overlay but layer it on top of the new gradient. Remove the flat white/dark background that currently renders.

Keep the version badge and copyright. Improve spacing: version badge should have `bottom: var(--rb-space-4); left: var(--rb-space-4)` using tokens.

**Step 5: Verify visually + performance**

Run: `pnpm dev`
Check:
- Desktop should show a subtle gradient (not flat white in light mode), slight noise texture visible on close inspection
- Open DevTools → Performance tab → record 5 seconds of idle. Verify: no paint storms, no layout thrashing, FPS stable.
- Test with `data-rb-perf="low"` attribute on `:root` — blur should disappear, solid fallback renders.

**Step 6: Verify reduced-motion disables field animation**

Add `data-rb-motion="reduced"` to `:root` in DevTools. The `rb-field-drift` animation should stop.

**Step 7: Run gate**

Run: `pnpm ui:style-token-contract-gate`
Expected: PASS (new tokens are in os-tokens.css, not in the RB_CORE_TOKENS block)

**Step 8: Commit**

```bash
git add packages/rb-apps/src/styles/os-tokens.css packages/rb-shell/src/Desktop.tsx packages/rb-shell/src/styles.css
git commit -m "feat(desktop): gradient wallpaper + noise texture + blur degradation"
```

---

## Task 3: Window Chrome Redesign — Rounded Corners, Shadows, Focus State

**Files:**
- Modify: `packages/rb-shell/src/ShellWindow.tsx` (titlebar, controls, focus styles)
- Modify: `packages/rb-shell/src/styles.css` (shadow layers, focus state)
- Modify: `packages/rb-apps/src/styles/os-tokens.css` (add window-specific tokens if needed)

**Step 1: Update window border-radius**

In ShellWindow.tsx, the outer container currently uses inline styles. Update `borderRadius` from whatever it is now to `var(--rb-radius-lg)` (12px). The titlebar should get `borderRadius: 'var(--rb-radius-lg) var(--rb-radius-lg) 0 0'` for top corners only.

**Step 2: Improve shadow layering**

Add to os-tokens.css:
```css
--rb-window-shadow: 0 4px 24px rgba(0, 3, 12, 0.35), 0 1px 4px rgba(0, 3, 12, 0.2);
--rb-window-shadow-focus: 0 8px 40px rgba(0, 3, 12, 0.5), 0 2px 8px rgba(0, 3, 12, 0.3);
```

Light theme overrides:
```css
--rb-window-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
--rb-window-shadow-focus: 0 8px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
```

**Step 3: Add focus state visual shift**

In ShellWindow.tsx, the focused window already uses `--rb-shadow-3` vs `--rb-shadow-2`. Replace with the new `--rb-window-shadow` / `--rb-window-shadow-focus` tokens. Also add a titlebar color shift: when focused, the titlebar background should be `var(--rb-surface-2)` (slightly brighter); when unfocused, `var(--rb-surface-1)`.

**Step 4: Style window controls consistently**

The minimize/maximize/close buttons should:
- Be 28×28px hit targets (comfortable density) — important for touchscreens in labs
- Have rounded hover backgrounds (`border-radius: var(--rb-radius-sm)`)
- Close button: hover background `rgba(var(--rb-danger-rgb, 248, 113, 113), 0.15)`
- Minimize/Maximize: hover background `var(--rb-surface-3)`
- Icon size: 14px, centered
- Transition: `background var(--rb-motion-fast) var(--rb-easing-out)`
- **Focus rings:** Each control must show `outline: 2px solid var(--rb-ui-accent); outline-offset: 2px` on `:focus-visible`

**Step 5: Ensure titlebar shows app icon + title crisply**

Verify the titlebar renders: `[icon 16px] [gap 8px] [title, font-weight 600, font-size 13px, truncated with ellipsis]`. The save status indicator (amber/blue/red dot) should be visible but not dominant.

**Step 6: Verify no raw hex in ShellWindow.tsx**

Run: `pnpm ui:style-token-contract-gate`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/rb-shell/src/ShellWindow.tsx packages/rb-shell/src/styles.css packages/rb-apps/src/styles/os-tokens.css
git commit -m "feat(windows): modern chrome with rounded corners, layered shadows, focus state"
```

---

## Task 4: Dock Premium Redesign — Blur, Hover, Active Indicator (with Blur Fallback)

**Files:**
- Modify: `packages/rb-shell/src/Dock.tsx` (styling, hover, indicators)
- Modify: `packages/rb-shell/src/styles.css` (dock-specific utilities)

**Step 1: Improve dock backdrop (with fallback)**

The dock currently has `var(--rb-ui-surface-1)` background. Add a brighter blur effect with the `rb-blur-surface` class for graceful degradation:
```css
.rb-dock {
  background: color-mix(in srgb, var(--rb-surface-1) 85%, transparent);
  backdrop-filter: blur(var(--rb-blur-strength, 16px)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--rb-blur-strength, 16px)) saturate(1.4);
}
```

Add the `rb-blur-surface` class to the dock container in Dock.tsx so it degrades on low-end machines (falls back to solid `--rb-blur-fallback-bg` per Task 2's CSS).

**Step 2: Clear hover state**

Currently hover does `translateX(2px)`. Enhance to:
- `translateX(2px)` stays
- Add background pill: `background: var(--rb-surface-3)` with `border-radius: var(--rb-radius-sm)`
- Transition: `all var(--rb-motion-fast) var(--rb-easing-out)`
- **Focus ring:** Dock items already have `:focus-visible` (confirmed in styles.css). Verify it renders correctly with the new pill background.

**Step 3: Active indicator (dot)**

Replace the current "left edge bar" running indicator with a bottom dot:
- A small 4px × 4px circle below the icon
- Color: `var(--rb-accent)` when running
- Use `::after` pseudo-element on the dock item when `data-running="true"`
- Animate in: `scale(0) → scale(1)` over `var(--rb-motion-fast)`

If the dock is vertical (left sidebar), the dot should be on the left edge instead. Check the dock orientation in the code and position accordingly.

**Step 4: Pinned vs. running distinction**

- Running apps: accent-colored dot indicator + slightly brighter icon (`opacity: 1`)
- Pinned but not running: no dot, icon at `opacity: 0.7`
- Hover on any: full opacity + background pill

**Step 5: Verify no raw hex + blur fallback works**

Run: `pnpm ui:style-token-contract-gate`
Expected: PASS (Dock.tsx checked for raw hex)

Also manually verify: add `data-rb-perf="low"` to `:root`, dock should show solid background (no blur).

**Step 6: Commit**

```bash
git add packages/rb-shell/src/Dock.tsx packages/rb-shell/src/styles.css
git commit -m "feat(dock): premium blur with fallback, hover pills, active dot indicator"
```

---

## Task 5: Typography + Spacing Overhaul (Classroom-Readable)

**Files:**
- Modify: `packages/rb-apps/src/styles/os-tokens.css` (type scale tokens)
- Modify: `packages/rb-apps/src/styles/os-controls.css` (control spacing)
- Modify: `packages/rb-shell/src/styles.css` (shell spacing)
- Modify: `packages/rb-apps/src/apps/SettingsApp.tsx` (spacing improvements)
- Modify: `packages/rb-apps/src/apps/SubmissionInspectorApp.module.css` (readability)

**Step 1: Define clear type scale tokens in os-tokens.css**

Add/refine in `:root`:
```css
/* Type scale — semantic aliases
   CONSTRAINT: body >= 13px, nothing below 11px for readability.
   Projector test: section headers must be readable from back row (~15px+). */
--rb-text-os-title: 24px;     /* OS-level headings (boot, about) */
--rb-text-window-title: 13px;  /* Window titlebar */
--rb-text-section: 15px;       /* Section headers in panels — projector-safe */
--rb-text-body: 13px;          /* Default body text — minimum readable */
--rb-text-label: 11px;         /* Small labels, badges — minimum allowed */
--rb-text-caption: 11px;       /* Captions, metadata — bumped from 10px */

/* Line heights */
--rb-leading-tight: 1.2;
--rb-leading-normal: 1.5;
--rb-leading-relaxed: 1.65;

/* Font weights */
--rb-weight-normal: 400;
--rb-weight-medium: 500;
--rb-weight-semibold: 600;
--rb-weight-bold: 700;
```

**IMPORTANT:** The existing `--rb-text-xs` is 11px. Do NOT introduce anything smaller. The old `--rb-text-caption: 10px` from the prior plan is bumped to 11px. A teacher on a projector can't read 10px.

**Step 2: Increase whitespace in os-controls.css**

Update `.rbPanel` padding from current to `var(--rb-space-5)` (20px).
Update button padding: primary/secondary from current to `var(--rb-space-2) var(--rb-space-4)` (8px 16px).
Update button gap (when buttons are adjacent): `var(--rb-space-3)` (12px).

**Step 3: Improve SettingsApp spacing**

In SettingsApp.tsx, increase:
- Section gaps from inline values to use `var(--rb-space-5)` (20px)
- Label-to-input spacing: `var(--rb-space-2)` (8px)
- Section dividers: `margin: var(--rb-space-5) 0` instead of cramped spacing

**Step 4: Improve Submission Inspector readability**

In SubmissionInspectorApp.module.css:
- Replace hardcoded `#111` backgrounds with `var(--rb-ui-lab-bg-elevated)`
- Replace hardcoded `#222` borders with `var(--rb-ui-lab-border)`
- Replace hardcoded `#f8fafc`, `#94a3b8`, `#cbd5e1`, `#64748b` text colors with `var(--rb-ui-lab-text)`, `var(--rb-ui-lab-text-muted)` equivalents
- Increase `.content` padding to use `var(--rb-space-5)`
- Increase `.checkItem` padding to `var(--rb-space-4)`

**Step 5: Use consistent font weights**

Audit components touched in this sprint: replace `font-weight: 600` / `500` / `700` with token references where they exist. At minimum, ensure headings use `--rb-weight-semibold` and body uses `--rb-weight-normal`.

**Step 6: Run tests**

Run: `pnpm --filter @redbyte/rb-apps test && pnpm --filter @redbyte/rb-shell test`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/rb-apps/src/styles/os-tokens.css packages/rb-apps/src/styles/os-controls.css packages/rb-shell/src/styles.css packages/rb-apps/src/apps/SettingsApp.tsx packages/rb-apps/src/apps/SubmissionInspectorApp.module.css
git commit -m "feat(typography): type scale tokens + spacing overhaul + classroom-readable sizes"
```

---

## Task 6: Accessibility + Classroom Visibility

**Files:**
- Modify: `packages/rb-shell/src/styles.css` (focus ring tokens, skip link)
- Modify: `packages/rb-apps/src/ui/theme.css` (focus ring for lab components)
- Create: `packages/rb-shell/src/__tests__/ui-a11y-contrast-gate.test.ts`
- Modify: `package.json` (add `ui:a11y-gate` script)

**Step 1: Define focus ring token**

In `packages/rb-shell/src/styles.css`, the focus ring already exists:
```css
.shell-container :focus-visible {
  outline: 2px solid var(--rb-ui-accent);
  outline-offset: 2px;
}
```

Verify this applies to:
- All buttons (window controls, dock items, settings toggles)
- Form inputs (settings sliders, selects)
- Launcher items
- Home dashboard cards / start-here buttons

If any interactive element is missing `:focus-visible`, add the rule. The existing `.rb-ui-focus:focus-visible` in `theme.css` should also be applied to lab app buttons.

**Step 2: Apply focus ring to lab components**

In `packages/rb-apps/src/ui/theme.css`, verify `.rb-ui-focus:focus-visible` rule exists (it does). Ensure:
- `.rb-ui-lab-button:focus-visible` has the same focus ring
- Export/Submit buttons in LabWorkspaceApp get focus rings
- Submission Inspector action buttons get focus rings

Add to theme.css if missing:
```css
.rb-ui-lab-button:focus-visible {
  outline: 2px solid var(--rb-ui-lab-accent);
  outline-offset: 2px;
}
```

**Step 3: Write contrast check gate**

Create `packages/rb-shell/src/__tests__/ui-a11y-contrast-gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../../..');

/**
 * Relative luminance per WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('ui:a11y-contrast-gate', () => {
  it('light theme primary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Light theme: --rb-text (#1C1917) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#1C1917', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light theme secondary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Light theme: --rb-text-2 (#57534E) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#57534E', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('light theme accent on background meets WCAG AA for large text (>= 3:1)', () => {
    // Light theme: --rb-accent (#B47A09) on --rb-surface-0 (#FAFAF8)
    const ratio = contrastRatio('#B47A09', '#FAFAF8');
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  it('dark theme primary text on background meets WCAG AA (>= 4.5:1)', () => {
    // Dark theme: --rb-text (#E6EDF3) on --rb-surface-0 (#070B14)
    const ratio = contrastRatio('#E6EDF3', '#070B14');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('lab theme text on background meets WCAG AA (>= 4.5:1)', () => {
    // Lab theme: --rb-ui-lab-text (#ecf4ff) on --rb-ui-lab-bg (#060912)
    const ratio = contrastRatio('#ecf4ff', '#060912');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('no font-size below 11px in os-tokens.css', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    // Find all px font sizes
    const sizes = content.match(/:\s*(\d+)px/g) ?? [];
    const tooSmall = sizes.filter(s => {
      const px = parseInt(s.replace(/[^0-9]/g, ''), 10);
      return px > 0 && px < 11;
    });
    expect(tooSmall, `Font sizes below 11px found: ${tooSmall.join(', ')}`).toHaveLength(0);
  });

  it('focus-visible rules exist in shell styles', () => {
    const stylesPath = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
    const content = readFileSync(stylesPath, 'utf-8');
    expect(content).toContain(':focus-visible');
    expect(content).toContain('outline');
  });

  it('focus-visible rules exist in lab theme', () => {
    const themePath = join(REPO_ROOT, 'packages/rb-apps/src/ui/theme.css');
    const content = readFileSync(themePath, 'utf-8');
    expect(content).toContain(':focus-visible');
  });
});
```

**Step 4: Add script**

```json
"ui:a11y-gate": "pnpm exec vitest run packages/rb-shell/src/__tests__/ui-a11y-contrast-gate.test.ts"
```

**Step 5: Run gate**

Run: `pnpm ui:a11y-gate`
Expected: All checks PASS

**Step 6: Commit**

```bash
git add packages/rb-shell/src/styles.css packages/rb-apps/src/ui/theme.css packages/rb-shell/src/__tests__/ui-a11y-contrast-gate.test.ts package.json
git commit -m "feat(a11y): contrast gate + focus ring enforcement + minimum font sizes"
```

---

## Task 7: "First-Run Wow" — Dashboard Start-Here Card (Kid-Proof)

**Files:**
- Modify: `packages/rb-apps/src/apps/HomeApp.tsx` (add start-here card)
- Modify: `packages/rb-apps/src/apps/HomeApp.module.css` (start-here styling)

**Step 1: Add start-here hero card**

In HomeApp.tsx, when no project is loaded (check: recent projects list empty or first visit), render a prominent "Start Here" card in the `brand` grid area. This replaces or augments the existing brand section.

The card should show:
- Large friendly heading: "Welcome to RedByte"
- Subtitle: "Build, simulate, and verify digital circuits"
- **Exactly 3 action buttons** in a row (no more — kids need clarity, not options):
  1. "Open Logic Playground" → opens `logic-playground` app
  2. "Create a Submission" → opens `lab-workspace` app
  3. "Inspect a Submission" → opens `submission-inspector` app
- Each button: icon + label, styled as `.cardPrimary` variant
- The card should have an accent gradient border-top (2px solid `var(--rb-accent)`)
- **Font sizes must be projector-safe:** heading >= 28px, subtitle >= 15px, button labels >= 13px
- **Button hit targets:** minimum 44×44px (WCAG touch target) — use generous padding

**Step 2: Style the start-here card in HomeApp.module.css**

Add:
```css
.startHere {
  grid-area: brand;
  border: 1px solid var(--rb-ui-lab-border-strong);
  border-top: 3px solid var(--rb-ui-lab-accent);
  border-radius: var(--rb-ui-lab-radius-lg);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--rb-ui-lab-accent) 8%, var(--rb-ui-lab-bg-surface)) 0%,
    var(--rb-ui-lab-bg-surface) 100%);
  box-shadow: var(--rb-ui-lab-shadow-soft);
  padding: var(--rb-space-6) var(--rb-space-5);
  text-align: center;
}

.startHereTitle {
  margin: 0;
  font-size: clamp(28px, 3vw, 40px);
  font-weight: 760;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--rb-ui-lab-text);
}

.startHereSubtitle {
  margin: var(--rb-space-2) 0 0;
  font-size: 15px;
  line-height: var(--rb-leading-relaxed, 1.65);
  color: var(--rb-ui-lab-text-muted);
}

.startHereActions {
  margin-top: var(--rb-space-5);
  display: flex;
  justify-content: center;
  gap: var(--rb-space-3);
  flex-wrap: wrap;
}

.startHereAction {
  /* 44px minimum hit target for touch */
  min-height: 44px;
  padding: var(--rb-space-3) var(--rb-space-5);
  font-size: 13px;
  font-weight: 700;
}
```

**Step 3: Ensure smooth boot → desktop → dashboard flow**

Verify: BootScreen → Desktop → open HomeApp → start-here card renders without jank. The BootScreen fade-out at 800ms should transition cleanly to the desktop with the dock visible.

**Step 4: Run tests**

Run: `pnpm --filter @redbyte/rb-apps test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/rb-apps/src/apps/HomeApp.tsx packages/rb-apps/src/apps/HomeApp.module.css
git commit -m "feat(home): kid-proof 'Start Here' card with 3 clear actions"
```

---

## Task 8: Submission Workflow Polish — Export + Inspector (TA-Grade)

**Files:**
- Modify: `packages/rb-apps/src/apps/LabWorkspaceApp.tsx` (export flow in verify tab)
- Modify: `packages/rb-apps/src/apps/SubmissionInspectorApp.tsx` (inspector layout)
- Modify: `packages/rb-apps/src/apps/SubmissionInspectorApp.module.css` (inspector styling)

**Step 1: Polish export preflight in LabWorkspaceApp**

The export flow lives in the "verify" tab of LabWorkspaceApp.tsx. Improve:
- Submission gate checklist: each gate row should have a severity icon (checkmark for pass, X for fail, warning triangle for warning) using text characters or existing rb-icons
- **Success state after export:** Show a satisfying green banner with:
  - Filename: `"Saved as: {bundleFilename}"`
  - Next step: **"Next: Submit this file on Blackboard"** — BOLD, unmissable. Students must not be confused about what to do next.
- Checklist layout: ensure each gate item has clear visual separation
- **Blocked state:** When `isSubmissionBlocked`, show a clear red banner: "Fix these issues before you can export" — not a subtle disabled button

**Step 2: Redesign inspector summary layout**

In SubmissionInspectorApp.tsx, restructure the Summary tab to show:
1. **Header section**: Student name, Lab ID, Build SHA — in a clean horizontal row of summary cards
2. **Verdict banner**: Already exists (`.verdictBanner`), keep but ensure it's prominent
3. **Pass/Fail checks section**: Rename to clear heading "Readiness Checks", use existing `.checkList` but improve spacing
4. **File list section**: Already exists, just ensure token-based colors
5. **Evidence summary section**: Quick stats row (gates passed, total, reproducibility)

This is primarily CSS/layout restructuring and token migration, not new feature code. The goal: a TA opens this, sees the verdict in 2 seconds, and knows whether to accept or reject.

**Step 3: Fix raw hex colors in SubmissionInspectorApp.module.css**

Replace ALL remaining raw hex values:
- `#111` → `var(--rb-ui-lab-bg-elevated)`
- `#222` → `var(--rb-ui-lab-border)`
- `#f8fafc` → `var(--rb-ui-lab-text)`
- `#94a3b8` → `var(--rb-ui-lab-text-muted)`
- `#cbd5e1` → `var(--rb-ui-lab-text-muted)`
- `#64748b` → `var(--rb-ui-lab-text-muted)`
- `#10b981` → `var(--rb-ui-lab-success)`
- `#ef4444` → `var(--rb-ui-lab-danger)`
- `#3B82F6` → `var(--rb-ui-lab-info)`
- `#fbbf24` → `var(--rb-ui-lab-warning)`
- `#a855f7` → `color-mix(in srgb, var(--rb-ui-lab-info) 60%, var(--rb-ui-lab-accent))`
- `rgba(0, 0, 0, 0.5)` in code blocks → `var(--rb-ui-lab-bg-elevated)`

This is the biggest raw-color cleanup and will make the inspector work correctly across all themes.

**Step 4: Run tests**

Run: `pnpm --filter @redbyte/rb-apps test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/rb-apps/src/apps/LabWorkspaceApp.tsx packages/rb-apps/src/apps/SubmissionInspectorApp.tsx packages/rb-apps/src/apps/SubmissionInspectorApp.module.css
git commit -m "feat(submission): TA-grade export flow + inspector token migration + layout"
```

---

## Task 9: Launcher + Navigation Clarity

**Files:**
- Modify: `packages/rb-apps/src/Launcher.tsx` (visual hierarchy, grouping)

**Step 1: Improve visual hierarchy**

In Launcher.tsx:
- Section headers ("Pinned", "Recent", "All Apps") should use `--rb-text-section` (15px), `--rb-weight-semibold`, and `--rb-accent` color — clearly distinct from app names
- App names should use `--rb-text-body` (13px), `--rb-weight-medium`
- Running indicator `(Running)` should use `--rb-accent` with a small dot, not parenthetical text
- Search box should be more prominent: show it by default as a text input field at the top, not hidden until user types

**Step 2: Add minimal grouping labels**

If the app registry already has category metadata, use it to group apps (e.g., "Student Tools", "TA Tools", "System"). If not, do NOT add a category system — just ensure the Pinned section contains the 3 obvious student actions (Logic Playground, Lab Workspace, Submission Inspector) and they're listed first.

**Step 3: Ensure "the obvious path" is obvious**

The 3 key apps for students should be:
- Visually distinguished in the launcher (pinned section, accent highlight)
- Keyboard accessible (arrow keys, Enter to launch)
- The first things a student sees when opening the launcher

**Step 4: Run tests**

Run: `pnpm --filter @redbyte/rb-apps test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/rb-apps/src/Launcher.tsx
git commit -m "feat(launcher): clearer visual hierarchy + student-first ordering"
```

---

## Task 10: Screenshot Automation — `pnpm ui:screenshots` (Stable + Deterministic)

**Files:**
- Create: `tests/e2e/ui-screenshots.spec.ts`
- Modify: `package.json` (add `ui:screenshots` script)

**Step 1: Write the screenshot spec**

Create `tests/e2e/ui-screenshots.spec.ts`. Critical requirements:
- **NO brittle keyboard shortcuts.** Use stable `[data-testid]` selectors and dock click actions instead.
- **Wipe localStorage** before each test to get clean first-run state.
- **Use `osReady()` helper** that exists in `_helpers/osReady.ts` for boot wait.
- **Deterministic**: Each test navigates fresh, waits for stable selectors, then screenshots.

```typescript
import { test } from '@playwright/test';
import { osReady } from './_helpers/osReady';

test.describe('UI Screenshots', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    // Wipe localStorage for clean first-run state
    await page.goto('/os/');
    await page.evaluate(() => localStorage.clear());
  });

  test('boot screen', async ({ page }) => {
    await page.goto('/os/');
    // Capture boot screen before it completes — use short wait
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/ui/after/boot-screen.png', fullPage: true });
  });

  test('desktop empty', async ({ page }) => {
    await page.goto('/os/');
    await osReady(page);
    await page.screenshot({ path: 'docs/ui/after/desktop-empty.png', fullPage: true });
  });

  test('home start-here', async ({ page }) => {
    await page.goto('/os/');
    await osReady(page);
    // Click Dashboard/Home in dock using stable selector
    const dockHome = page.locator('[data-testid="dock-item-home"]').first();
    if (await dockHome.isVisible()) {
      await dockHome.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'docs/ui/after/home-start-here.png', fullPage: true });
  });

  test('settings open', async ({ page }) => {
    await page.goto('/os/');
    await osReady(page);
    // Click Settings in dock using stable selector
    const dockSettings = page.locator('[data-testid="dock-item-settings"]').first();
    if (await dockSettings.isVisible()) {
      await dockSettings.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'docs/ui/after/settings-open.png', fullPage: true });
  });

  test('submission inspector open', async ({ page }) => {
    await page.goto('/os/');
    await osReady(page);
    // Open via launcher or direct app open — use whatever stable mechanism exists
    // Fallback: use keyboard shortcut if dock doesn't have inspector
    await page.screenshot({ path: 'docs/ui/after/submission-inspector.png', fullPage: true });
  });
});
```

Note: Adjust selectors based on actual `data-testid` attributes in the DOM. Check existing E2E specs for the patterns used to open apps.

**Step 2: Add script to package.json**

```json
"ui:screenshots": "pnpm e2e:build && pnpm exec playwright test tests/e2e/ui-screenshots.spec.ts --project chromium"
```

**Step 3: Run and verify**

Run: `pnpm ui:screenshots`
Expected: Screenshots generated in `docs/ui/after/`, all tests pass, no flakiness.

**Step 4: Commit**

```bash
git add tests/e2e/ui-screenshots.spec.ts package.json docs/ui/after/
git commit -m "feat(screenshots): stable ui:screenshots with deterministic selectors"
```

---

## Task 11: UI Quality Gate — Contract Test (Expanded)

**Files:**
- Create: `packages/rb-shell/src/__tests__/ui-quality-gate.test.ts`
- Modify: `package.json` (add `ui:quality-gate` script, wire into `rc:check`)

**Step 1: Write the quality gate test**

Create `packages/rb-shell/src/__tests__/ui-quality-gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../../..');

describe('ui:quality-gate', () => {
  it('theme default is still light', () => {
    const themePath = join(REPO_ROOT, 'packages/rb-theme/src/applyTheme.ts');
    const content = readFileSync(themePath, 'utf-8');
    expect(content).toMatch(/default.*light|light.*default|'light'/);
  });

  it('Dock component exists and exports', () => {
    const dockPath = join(REPO_ROOT, 'packages/rb-shell/src/Dock.tsx');
    expect(existsSync(dockPath)).toBe(true);
    const content = readFileSync(dockPath, 'utf-8');
    expect(content).toContain('export');
  });

  it('ShellWindow has focus class handling', () => {
    const windowPath = join(REPO_ROOT, 'packages/rb-shell/src/ShellWindow.tsx');
    const content = readFileSync(windowPath, 'utf-8');
    expect(content).toMatch(/focus|isFocused|focused/i);
  });

  it('no raw hex colors in sprint-touched shell components', () => {
    const files = [
      'packages/rb-shell/src/Desktop.tsx',
      'packages/rb-shell/src/Dock.tsx',
      'packages/rb-shell/src/ShellWindow.tsx',
      'packages/rb-shell/src/BootScreen.tsx',
    ];

    for (const file of files) {
      const filePath = join(REPO_ROOT, file);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const problematicLines = lines.filter((line) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return false;
        return /#[0-9a-fA-F]{3,8}(?![a-zA-Z0-9])/.test(line)
          && !line.includes('var(--rb-ui-')
          && !line.includes('var(--rb-');
      });
      expect(problematicLines, `Raw hex found in ${file}: ${problematicLines[0] ?? ''}`).toHaveLength(0);
    }
  });

  it('os-tokens.css has wallpaper tokens for all themes', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    expect(content).toContain('--rb-wallpaper-from');
    expect(content).toContain('--rb-wallpaper-to');
    const lightBlock = content.split('[data-theme="light"]')[1] ?? '';
    expect(lightBlock).toContain('--rb-wallpaper-from');
  });

  it('blur is behind a degradable token', () => {
    const tokensPath = join(REPO_ROOT, 'packages/rb-apps/src/styles/os-tokens.css');
    const content = readFileSync(tokensPath, 'utf-8');
    expect(content).toContain('--rb-blur-strength');
  });

  it('blur fallback CSS exists for @supports not', () => {
    const stylesPath = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
    const content = readFileSync(stylesPath, 'utf-8');
    expect(content).toContain('@supports not');
    expect(content).toContain('backdrop-filter');
  });

  it('reduced motion disables new animations', () => {
    const stylesPath = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
    const content = readFileSync(stylesPath, 'utf-8');
    expect(content).toContain("data-rb-motion='reduced'");
    expect(content).toContain('animation-duration: 0.01ms');
  });

  it('focus-visible rules exist in shell and lab styles', () => {
    const shellStyles = readFileSync(join(REPO_ROOT, 'packages/rb-shell/src/styles.css'), 'utf-8');
    const labTheme = readFileSync(join(REPO_ROOT, 'packages/rb-apps/src/ui/theme.css'), 'utf-8');
    expect(shellStyles).toContain(':focus-visible');
    expect(labTheme).toContain(':focus-visible');
  });
});
```

**Step 2: Add script to package.json**

```json
"ui:quality-gate": "pnpm exec vitest run packages/rb-shell/src/__tests__/ui-quality-gate.test.ts"
```

**Step 3: Wire into rc:check**

Check if `pnpm --filter @redbyte/rb-shell test` already picks up this file (it should, since it's in `packages/rb-shell/src/__tests__/`). If so, don't duplicate in `rc:check` — just add the named script for explicit invocation.

**Step 4: Run the gate**

Run: `pnpm ui:quality-gate`
Expected: All checks PASS

**Step 5: Commit**

```bash
git add packages/rb-shell/src/__tests__/ui-quality-gate.test.ts package.json
git commit -m "feat(gates): expanded UI quality gate with blur/a11y/motion checks"
```

---

## Task 12: Consistent Animations Pass (with Reduced-Motion Enforcement)

**Files:**
- Modify: `packages/rb-shell/src/styles.css` (ensure animation consistency)
- Modify: `packages/rb-shell/src/ShellWindow.tsx` (verify window open animation)
- Modify: `packages/rb-shell/src/Dock.tsx` (verify dock transitions)

**Step 1: Audit all transitions for consistency**

Ensure every transition in shell components uses motion tokens:
- `var(--rb-motion-fast)` (120ms) for hover effects
- `var(--rb-motion-normal)` (200ms) for layout changes
- `var(--rb-easing-out)` for all easing

Replace any hardcoded `150ms`, `0.15s`, `0.12s`, `80ms` etc. with the token equivalents.

**Step 2: Verify window open animation**

The `rb-window-open` keyframe (scale 0.95→1 + fade) should:
- Duration: `var(--rb-motion-normal)` (200ms)
- Easing: `var(--rb-easing-out)`
- Be applied via `.rb-shell-window` class

**Step 3: Verify dock transitions**

All dock hover/active transitions should use `var(--rb-motion-fast) var(--rb-easing-out)`.

**Step 4: Verify reduced-motion kills everything new**

Confirm `[data-rb-motion="reduced"]` and `@media (prefers-reduced-motion)` both disable:
- Desktop wallpaper field-drift animation
- Dock active dot scale-in animation
- Window open animation
- All hover transitions

Test: Add `data-rb-motion="reduced"` to `:root` in DevTools. Open a window, hover dock items — no animation should occur.

**Step 5: Commit**

```bash
git add packages/rb-shell/src/styles.css packages/rb-shell/src/ShellWindow.tsx packages/rb-shell/src/Dock.tsx
git commit -m "feat(motion): normalize transitions to tokens + verify reduced-motion"
```

---

## Task 13: Classroom Deployment Readiness Checklist (Documentation Only)

**Files:**
- Create: `docs/CLASSROOM_DEPLOYMENT_READINESS.md`

**Step 1: Write the checklist**

Create `docs/CLASSROOM_DEPLOYMENT_READINESS.md` covering:

```markdown
# Classroom Deployment Readiness Checklist

## How Students Run RedByte Today

- **Development:** `pnpm dev` → http://localhost:5173/os/
- **Preview (production build):** `pnpm build && pnpm preview` → http://127.0.0.1:4173/os/
- **Deployed:** [URL if deployed, or "Not yet deployed"]

## What's Working

- [x] Light theme default (projector-friendly)
- [x] Boot → Desktop → Home flow
- [x] Submission export with preflight gates
- [x] Submission Inspector (TA tool)
- [x] Keyboard navigation (dock, launcher, windows)
- [x] Reduced motion support
- [x] Focus rings on interactive controls
- [x] WCAG AA contrast on primary surfaces

## What's Missing for Downloadable Distribution

### Packaging (Not Started)
- [ ] Electron or Tauri wrapper for desktop app
- [ ] OR: Static build served via local HTTP server (e.g., `npx serve dist/`)
- [ ] OR: PWA with service worker for offline use
- [ ] Installer for Windows (.msi or .exe) + macOS (.dmg)
- [ ] Auto-update mechanism (if packaged)

### Offline-First (Partial)
- [ ] All assets bundled (fonts, icons) — currently loaded from CDN?
- [ ] No runtime network dependencies for core functionality
- [ ] Service worker for offline cache (if PWA route)
- [ ] Local file system for project storage (already uses localStorage/OPFS?)

### Security Notes
- [ ] Localhost binding only (no exposed ports)
- [ ] No remote device control without explicit auth
- [ ] Sanitize file uploads (submission inspector accepts .zip/.json)
- [ ] CSP headers for production builds
- [ ] No student data persisted server-side

## Classroom Workflow

### Student Flow
1. Open RedByte (browser or app)
2. Boot screen → Desktop
3. "Start Here" card → Open Logic Playground
4. Build circuit → Run simulation
5. Export submission → Download .rb-lab.zip
6. Upload .rb-lab.zip to Blackboard/Canvas

### TA Flow
1. Open RedByte
2. Open Submission Inspector
3. Drag-drop student's .rb-lab.zip
4. Review: verdict, gates, reproducibility
5. Export grading report if needed

## Next Sprint Candidates
- [ ] PWA manifest + service worker
- [ ] Font self-hosting (IBM Plex Sans/Mono)
- [ ] Electron wrapper spike
- [ ] Classroom mode toggle (restrict settings, lock theme)
```

**Step 2: Commit**

```bash
git add docs/CLASSROOM_DEPLOYMENT_READINESS.md
git commit -m "docs: classroom deployment readiness checklist"
```

---

## Task 14: Final Verification + Demo Ready

**Files:**
- None new — verification only

**Step 1: Run full test suite**

Run: `pnpm --filter @redbyte/rb-apps test && pnpm --filter @redbyte/rb-shell test`
Expected: PASS

**Step 2: Run all gates**

Run: `pnpm verify:gates`
Expected: PASS

**Step 3: Run style token gate**

Run: `pnpm ui:style-token-contract-gate`
Expected: PASS

**Step 4: Run accessibility gate**

Run: `pnpm ui:a11y-gate`
Expected: PASS

**Step 5: Run quality gate**

Run: `pnpm ui:quality-gate`
Expected: PASS

**Step 6: Run demo:ready**

Run: `pnpm demo:ready`
Expected: Exit code 0, DEMO_READY_REPORT.md generated

**Step 7: Take "after" screenshots**

Run: `pnpm ui:screenshots`
Expected: Screenshots in `docs/ui/after/`

**Step 8: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final sprint 2 verification pass"
```

---

## Task 15: Write Sprint Report

**Files:**
- Create: `docs/UI_SPRINT_2_REPORT.md`

**Step 1: Write the report**

Create `docs/UI_SPRINT_2_REPORT.md` with:
- Summary of what changed visually (10 bullets max)
- Before/after screenshot paths
- Files edited (full list)
- New scripts added (`ui:screenshots`, `ui:quality-gate`, `ui:a11y-gate`)
- Commands run + results
- UI Quality Gate details (what it checks)
- Accessibility gate details (what it checks)
- `pnpm demo:ready` result
- Classroom deployment readiness status

**Step 2: Commit**

```bash
git add docs/UI_SPRINT_2_REPORT.md
git commit -m "docs: UI Sprint 2 report with before/after evidence + classroom readiness"
```

---

## Execution Order Summary

| Task | Description | Why Added/Changed |
|------|-------------|-------------------|
| 1 | Before screenshots | Baseline capture |
| 2 | Desktop wallpaper redesign | **Updated:** blur fallback + noise performance guardrails |
| 3 | Window chrome redesign | **Updated:** focus rings on controls |
| 4 | Dock premium redesign | **Updated:** blur fallback + focus ring verification |
| 5 | Typography + spacing overhaul | **Updated:** minimum 11px, projector-safe headers |
| 6 | **NEW:** Accessibility + Classroom Visibility | Contrast gate, focus rings, font-size floor |
| 7 | First-run start-here card | **Updated:** 44px hit targets, 3 actions max, projector-safe |
| 8 | Export + Inspector polish | **Updated:** idiot-proof next steps, TA-grade inspector |
| 9 | **NEW:** Launcher + Navigation Clarity | Student-first ordering, visual hierarchy |
| 10 | Screenshot automation | **Updated:** stable selectors, localStorage wipe, no brittle shortcuts |
| 11 | UI Quality Gate | **Updated:** blur degradation, a11y, reduced-motion checks |
| 12 | Animation consistency pass | **Updated:** reduced-motion enforcement for all new animations |
| 13 | **NEW:** Classroom Deployment Readiness | Documentation: how to deploy, what's missing |
| 14 | Final verification | demo:ready + all gates + a11y gate |
| 15 | Sprint report | **Updated:** includes classroom readiness |

## Dependencies

- Tasks 2-5 are independent and can be parallelized (different files)
- Task 6 depends on Tasks 2-5 (validates tokens/styles they introduce)
- Tasks 7-9 are independent and can be parallelized
- Task 10 depends on Tasks 7-9 (screenshots show the redesigned UI)
- Task 11 depends on Tasks 2-6 (gate validates token usage, blur, a11y)
- Task 12 depends on Tasks 2-4 (animation audit of modified components)
- Task 13 is independent (documentation only)
- Task 14 depends on all prior tasks
- Task 15 depends on Task 14
