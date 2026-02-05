# Phase 3A Smoke Checklist (Windowing + OS Interaction)

## Last Validated

- Date: (pending)
- Commit: (pending)
- Browser: (pending)
- Result: (pending)

## Setup

- Start OS (dev or preview)
- Ensure a clean workspace (no saved weird layout)
- Optional: disable perf mode (default)

## Checklist

### 1) Focus + Z-Index correctness (core)

1. Open 3 windows: **Virtual Lab**, **Logic Playground**, **Files**.
2. Click each window body in sequence: Lab → Files → Playground.
3. Open Launcher, open another window (**Terminal**).

Pass:
- Clicked window comes to front every time.
- Active title bar (or equivalent focus styling) matches the frontmost window.
- Keyboard input goes to the focused window (no “stuck focus”).

### 2) Minimize / Restore

1. Minimize a background window, then minimize the front window.
2. Restore via taskbar/dock buttons (or whatever UI you use).
3. Restore order: restore background first, then front.

Pass:
- Restored window becomes frontmost and focused.
- No windows restore behind another window.
- No “ghost” minimized state (window content visible but store says minimized, or vice-versa).

### 3) Window placement and off-screen safety

1. Move a window partially off-screen (top-left and bottom-right).
2. Reload OS.
3. Reopen the same app.

Pass:
- Window is clamped back onto screen or repositioned safely.
- No windows spawn entirely off-screen.

### 4) Dock/Launcher interactions

1. Open Launcher, click outside to dismiss.
2. Use Launcher to open an already-open app.
3. Use Dock to open an already-open app.

Pass:
- Launcher dismisses reliably.
- Opening an already-open app focuses/raises it (no duplicate windows unless intended).

## Scripted Gate (optional, high-signal)

- `pnpm -s os:window-raise-gate`

## Revalidate When...

Re-run this checklist when changing any of:

- `packages/rb-windowing/src/store.*` (focus/z-index/minimize/restore semantics)
- `packages/rb-shell/src/Shell.*` (open/restore/focus routing)
- `packages/rb-shell/src/Dock.*` (open-existing behavior)
- `packages/rb-shell/src/ShellWindow.*` (focus/active styling + pointer handlers)

