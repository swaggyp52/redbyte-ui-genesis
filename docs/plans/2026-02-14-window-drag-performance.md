# Window Drag Performance & Interaction Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make window dragging smooth at 60fps with no dropped drags, no jank, and no cascading re-renders.

**Architecture:** Three surgical changes — (1) move drag listeners to document level so fast mouse movement can't escape the window, (2) use transform-based positioning during drag for compositor-only updates, (3) debounce localStorage persistence so it never fires during active drag. All changes are in ShellWindow.tsx and store.ts.

**Tech Stack:** React 19, Zustand 5, CSS transforms, requestAnimationFrame

---

## Context for Implementor

The current drag system has 6 compounding performance problems:

1. Mouse events are on the window `div` — fast movement escapes the bounds and drops the drag
2. `left`/`top` positioning forces layout recalc every frame
3. `saveSession()` writes ALL windows to localStorage on every Zustand state change — including during drag
4. `Date.now()` throttle is not sync'd with browser paint cycle
5. `filter: saturate(0.92)` on unfocused windows creates expensive GPU layers
6. Shell subscribes to entire `windows` array — every move triggers Shell re-render

Key files:
- `packages/rb-shell/src/ShellWindow.tsx` — window chrome + drag/resize handlers
- `packages/rb-windowing/src/store.ts` — Zustand window state + localStorage persistence
- `packages/rb-shell/src/Shell.tsx` — top-level component that renders all windows

---

### Task 1: Move Drag/Resize Listeners to Document Level

**Files:**
- Modify: `packages/rb-shell/src/ShellWindow.tsx:183-275` (startDrag, onMoveDrag, finishDrag)
- Test: `packages/rb-shell/src/__tests__/window-snap-preview.test.tsx` (existing, verify no breakage)

**Problem:** `onMouseMove` is on the window container div. When the user drags quickly, the cursor escapes the div, triggering `onMouseLeave` → `finishDrag(false)`. The drag silently drops.

**Step 1: Rewrite startDrag to attach document-level listeners**

In `ShellWindow.tsx`, replace the current `startDrag` function and add a document-level listener pattern:

```tsx
const startDrag = (e: React.MouseEvent) => {
  if (isMax || isMin) return;
  e.preventDefault(); // prevent text selection during drag
  draggingRef.current = true;
  setDragging(true);
  startRef.current = { x: e.clientX, y: e.clientY };
  dragBoundsRef.current = { ...state.bounds };
  hasMovedRef.current = false;
  clearSnapPreview();
  onFocus();
};
```

**Step 2: Replace the onMouseMove/onMouseUp/onMouseLeave on the container with a useEffect that manages document listeners**

Add this useEffect after the existing refs:

```tsx
useEffect(() => {
  if (!dragging) return;

  const onDocMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const startPos = startRef.current;
    if (!startPos) return;

    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    const currentBounds = dragBoundsRef.current ?? state.bounds;
    let newX = currentBounds.x + dx;
    let newY = currentBounds.y + dy;

    if (newY < TOPBAR_HEIGHT) newY = TOPBAR_HEIGHT;
    const vw = window.innerWidth;
    const minX = DOCK_WIDTH - currentBounds.width + MIN_VISIBLE_SIDE;
    const maxX = vw - MIN_VISIBLE_SIDE;
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;

    const nextBounds = { ...currentBounds, x: newX, y: newY };
    hasMovedRef.current = true;
    dragBoundsRef.current = nextBounds;
    lastBoundsRef.current = nextBounds;

    // rAF-based throttle instead of Date.now()
    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      rafIdRef.current = requestAnimationFrame(() => {
        rafPendingRef.current = false;
        const pending = dragBoundsRef.current;
        if (pending) onMove(pending.x, pending.y);
      });
    }

    lastPointerRef.current = { x: e.clientX, y: e.clientY, shiftKey: e.shiftKey };
    handleSnapPreview(e.clientX, e.clientY, e.shiftKey);
    startRef.current = { x: e.clientX, y: e.clientY };
  };

  const onDocMouseUp = (e: MouseEvent) => {
    finishDrag(true);
  };

  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);

  return () => {
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
  };
}, [dragging]);
```

Add new refs near the top:

```tsx
const startRef = useRef<{ x: number; y: number } | null>(null);
const rafPendingRef = useRef(false);
const rafIdRef = useRef<number>(0);
```

**Step 3: Do the same for resize — document-level listeners when resizing**

Same pattern: when `resizing` state is set, attach document-level mousemove/mouseup. Clean up on state change.

**Step 4: Remove onMouseMove/onMouseUp/onMouseLeave from the container div**

Change the container div event handlers:

```tsx
// BEFORE:
onMouseMove={dragging ? onMoveDrag : resizing ? onResizeDrag : undefined}
onMouseUp={() => { ... }}
onMouseLeave={() => { ... }}

// AFTER:
// Remove all three — document-level listeners handle it now
```

**Step 5: Run existing tests**

```bash
pnpm exec vitest run packages/rb-shell/src/__tests__/window-snap-preview.test.tsx
```

Expected: PASS (snap preview logic unchanged)

**Step 6: Commit**

```bash
git add packages/rb-shell/src/ShellWindow.tsx
git commit -m "perf: move drag/resize listeners to document level

Prevents dropped drags when cursor escapes window bounds during fast movement.
Replaces Date.now() throttle with requestAnimationFrame for paint-sync'd updates."
```

---

### Task 2: Use transform:translate3d During Drag

**Files:**
- Modify: `packages/rb-shell/src/ShellWindow.tsx:322-344` (containerStyle useMemo)

**Problem:** Windows use `left`/`top` for positioning which forces layout recalculation on every frame. During drag, `transform: translate3d()` is compositor-only — no layout thrash.

**Step 1: Add a dragOffset state for visual-only transform during drag**

The idea: during drag, keep `left`/`top` at the ORIGINAL position and use `transform: translate3d(dx, dy, 0)` for the visual offset. On drag end, commit the final position via `onMove` and reset the transform.

Add ref:

```tsx
const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
```

During drag moves (in the document mousemove handler), instead of calling `onMove()` on every rAF, just update the visual offset:

```tsx
// In the rAF callback during drag:
rafIdRef.current = requestAnimationFrame(() => {
  rafPendingRef.current = false;
  const pending = dragBoundsRef.current;
  if (!pending) return;
  const original = originalBoundsRef.current;
  if (!original) return;
  setDragOffset({
    dx: pending.x - original.x,
    dy: pending.y - original.y,
  });
});
```

On drag end, commit final position:

```tsx
const finishDrag = (shouldSnap: boolean) => {
  // ... existing logic ...
  // Commit final position to store
  const final = dragBoundsRef.current;
  if (final && hasMovedRef.current) {
    onMove(final.x, final.y);
  }
  setDragOffset(null);
  // ... snap logic ...
};
```

**Step 2: Update containerStyle to use transform during drag**

```tsx
const containerStyle = useMemo(() => {
  const { bounds, zIndex, focused } = state;
  const opacity = mounted ? 1 : 0;
  const mountTransform = mounted ? '' : 'scale(0.98) translateY(4px)';
  const maxBounds = isMax ? getMaximizedBounds() : null;

  const baseX = maxBounds ? maxBounds.x : bounds.x;
  const baseY = maxBounds ? maxBounds.y : bounds.y;

  // During drag, apply offset via transform (compositor-only, no layout)
  let transform = mountTransform;
  if (dragOffset) {
    transform = `translate3d(${dragOffset.dx}px, ${dragOffset.dy}px, 0)`;
  }

  return {
    position: 'absolute' as const,
    left: baseX,
    top: baseY,
    width: maxBounds ? maxBounds.width : bounds.width,
    height: maxBounds ? maxBounds.height : bounds.height,
    zIndex,
    opacity,
    transform: transform || undefined,
    willChange: dragOffset ? 'transform' : undefined,
    transition: dragOffset ? 'none' : `opacity var(--rb-motion-normal) var(--rb-easing-out), transform var(--rb-motion-normal) var(--rb-easing-out)`,
    background: 'var(--rb-surface-1)',
    border: focused ? '1px solid var(--rb-border-strong)' : '1px solid var(--rb-border)',
    borderRadius: isMax ? 0 : 'var(--rb-radius-lg)',
    overflow: 'hidden',
    boxShadow: focused ? 'var(--rb-shadow-3)' : 'var(--rb-shadow-1)',
    display: isMin ? 'none' : 'block',
  } as React.CSSProperties;
}, [state, isMax, isMin, mounted, dragOffset]);
```

Key changes:
- `will-change: transform` during drag (removed after)
- `transition: none` during drag (no CSS animation fighting the drag)
- Removed `filter: saturate(0.92)` — this was an expensive GPU filter

**Step 3: Run tests**

```bash
pnpm exec vitest run packages/rb-shell/src/__tests__/window-snap-preview.test.tsx
```

**Step 4: Commit**

```bash
git add packages/rb-shell/src/ShellWindow.tsx
git commit -m "perf: use transform-based positioning during window drag

Compositor-only updates during drag. No layout recalculation per frame.
Adds will-change:transform during drag, removes after.
Removes expensive filter:saturate on unfocused windows."
```

---

### Task 3: Debounce localStorage Persistence During Drag

**Files:**
- Modify: `packages/rb-windowing/src/store.ts:228-237` (subscribe + saveSession)
- Test: `packages/rb-windowing/src/__tests__/window-raise-gate.test.ts` (existing)

**Problem:** `saveSession()` writes all windows to localStorage on every Zustand state change — including during drag. That's JSON.stringify + localStorage.setItem 60x/sec.

**Step 1: Add a drag-in-progress flag and debounce**

```typescript
// Add at module level, above initStoreIfNeeded:
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _isDragging = false;

/** Call to suppress localStorage writes during drag. */
export function setDragActive(active: boolean) {
  _isDragging = active;
  // When drag ends, flush immediately
  if (!active) {
    const store = initStoreIfNeeded();
    const state = store.getState();
    saveSession(state.windows, state.nextZIndex);
  }
}

function debouncedSaveSession(windows: WindowState[], nextZIndex: number) {
  if (_isDragging) return; // Never write during drag
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveSession(windows, nextZIndex);
    _saveTimer = null;
  }, 300);
}
```

**Step 2: Update the store subscriber to use debounced save**

```typescript
// In initStoreIfNeeded():
_store.subscribe((state) => {
  debouncedSaveSession(state.windows, state.nextZIndex);
});
```

**Step 3: Export setDragActive from the package index**

In `packages/rb-windowing/src/index.ts`, add:

```typescript
export { setDragActive } from './store';
```

**Step 4: Call setDragActive from ShellWindow during drag**

In `ShellWindow.tsx`, import and use:

```tsx
import { setDragActive } from '@redbyte/rb-windowing';

// In startDrag:
setDragActive(true);

// In finishDrag:
setDragActive(false);

// In startResize:
setDragActive(true);

// In finishResize:
setDragActive(false);
```

**Step 5: Run tests**

```bash
pnpm exec vitest run packages/rb-windowing/src/__tests__/window-raise-gate.test.ts
```

**Step 6: Commit**

```bash
git add packages/rb-windowing/src/store.ts packages/rb-windowing/src/index.ts packages/rb-shell/src/ShellWindow.tsx
git commit -m "perf: debounce localStorage save, suppress during drag

Prevents 60 JSON.stringify + localStorage.setItem calls/sec during window drag.
Session state saved 300ms after last change, never during active drag/resize."
```

---

### Task 4: Run Full Test Suite and Build

**Step 1: Run all window-related tests**

```bash
pnpm exec vitest run packages/rb-shell/src/__tests__/window-snap-preview.test.tsx packages/rb-windowing/src/__tests__/window-raise-gate.test.ts packages/rb-shell/src/__tests__/shell-lifecycle.test.tsx
```

**Step 2: Run build**

```bash
pnpm build
```

**Step 3: Fix any issues found**

If tests or build fail, fix and re-commit.

---

## Acceptance Criteria

- [ ] Dragging never drops when mouse moves fast (even across entire screen)
- [ ] Dragging feels smooth — no visible stutter
- [ ] No localStorage writes during active drag (verify in DevTools)
- [ ] Unfocused windows don't have `filter: saturate()` applied
- [ ] Shell component does NOT re-render when dragging a window (verify with React DevTools Profiler)
- [ ] All existing tests pass
- [ ] Build succeeds
