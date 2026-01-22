# implementation_plan.md

## Issue Ranking (P0/P1/P2)

### P0 — Actively Frustrating or Blocking
- New windows sometimes open partially off-screen (Window spawn/placement)
- Z-ordering of windows is inconsistent (Window focus)
- Important controls may be off-screen or require manual resizing (Layout predictability)
- Dragging nodes can feel laggy (Canvas responsiveness)

### P1 — Confusing but Usable
- Active window highlighting is subtle or missing
- Initial focus not always on main canvas or primary control
- RightDock/inspectors not always visible when relevant
- Logic Playground loads with viewport not centered/zoomed as expected
- Perspective switching can feel abrupt; state transitions unclear
- Keyboard navigation/focus inconsistent after switching
- Pan/zoom is sometimes jumpy or too sensitive
- Node movement can be imprecise; accidental small moves/drops
- Users may not always know which mode they are in
- Mode changes lack clear cues

### P2 — Minor Polish
- Scroll-wheel can conflict with browser/UI
- Accidental selection/deselection near nodes
- Some state transitions (e.g., opening/closing inspectors) are abrupt

---

## Implementation Plan (Minimal, Targeted Fixes)

### 1. Window & Focus Behavior
- **File(s):** `rb-windowing`, `LogicPlaygroundApp.tsx`, `RightDock.tsx`
- Ensure new windows spawn fully on-screen (clamp position to viewport)
- Fix Z-order logic so newly opened window is always on top
- Add/clarify active window highlighting (border or shadow)
- Set initial focus to main canvas or primary control on Logic Playground open
- Ensure RightDock/inspectors are visible when contextually relevant

### 2. Layout & Navigation Predictability
- **File(s):** `LogicPlaygroundApp.tsx`, `SplitViewLayout.tsx`, `TopCommandBar.tsx`
- Center and zoom viewport on circuit or default area on load
- Ensure all primary controls are visible at all times (responsive layout tweaks)
- Add subtle transition/animation for perspective switching
- Audit and clarify keyboard navigation/focus logic

### 3. Canvas Interaction Polish
- **File(s):** `LogicCanvas.tsx`, `rb-logic-view`
- Optimize drag event handling for lower latency
- Clamp pan/zoom to reasonable bounds; smooth scroll-wheel input
- Snap node movement to grid, reduce accidental small moves
- Prevent accidental selection/deselection when clicking near nodes

### 4. OS Mental Model Clarity
- **File(s):** `LogicPlaygroundApp.tsx`, `StatusBar.tsx`, `rb-utils`
- Add clear mode indicator (Build/Analyze/Debug) in status bar
- Add visual/behavioral cues for mode changes (e.g., fade, highlight)
- Add micro-animations for state transitions (where appropriate)

---

## Notes
- All changes must be small, local, and use existing abstractions.
- No new features, panels, or apps.
- No changes to grading, evidence, lab specs, or determinism logic.
- All fixes should be verifiable by walking the golden path as a new user.
