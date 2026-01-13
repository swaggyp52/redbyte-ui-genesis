# Logic Playground Snapshot Loop Fix

**Date**: 2026-01-13  
**Branch**: `fix/logicplayground-snapshot-loop`  
**Commit**: 9f9ef286

## Problem

Logic Playground crashed immediately on load with:
1. React warning: `The result of getSnapshot should be cached to avoid an infinite loop`
2. Render storm (60+ consecutive renders)
3. Fatal error: `Maximum update depth exceeded`
4. React blamed `<CircuitToolStrip>` component

## Root Cause

The caching wrapper in `packages/rb-utils/src/zustand.ts` included `selector` in the dependency array of `getSnapshot` and `getServerSnapshot` callbacks (lines 38, 50).

When components use inline arrow function selectors:
```tsx
const { toolMode, setToolMode, ... } = useLogicViewStore(
  (state) => ({  // ← new function identity every render
    toolMode: state.toolMode,
    // ...
  }),
  shallow
);
```

The inline arrow function has a **new identity on every render**, so:
1. `getSnapshot` is recreated (different deps)
2. `useSyncExternalStore` sees new `getSnapshot` → re-subscribes
3. Re-subscription triggers component re-render
4. New render creates new inline arrow function → back to step 1
5. **Infinite loop**

## Solution

Modified `packages/rb-utils/src/zustand.ts`:

**Before**:
```typescript
const getSnapshot = React.useCallback(() => {
  // ...
  const snapshot = selector(state);
  // ...
}, [api, selector]);  // ← selector changes every render
```

**After**:
```typescript
const selectorRef = React.useRef(selector);
selectorRef.current = selector;  // Always capture latest closure

const getSnapshot = React.useCallback(() => {
  // ...
  const snapshot = selectorRef.current(state);
  // ...
}, [api]);  // ← only depends on stable api
```

This makes `getSnapshot`/`getServerSnapshot` **stable** (no recreation on selector change), while still capturing the latest selector closure via the ref.

## Why This Works

1. **Stable callbacks**: `getSnapshot` only depends on `api`, which never changes
2. **No re-subscription**: `useSyncExternalStore` receives the same callback every render
3. **Fresh selector**: `selectorRef.current` is updated every render, so closures stay current
4. **State-based caching**: `lastStateRef` check prevents recomputation when store state hasn't changed

## Affected Component

Primary culprit: `packages/rb-apps/src/components/CircuitToolStrip.tsx` (lines 43-51)  
Uses inline arrow function selector with `shallow` comparison.

Other components use stable selectors (per-field) and were not affected.

## Verification Steps

1. Check out branch: `git checkout fix/logicplayground-snapshot-loop`
2. Start dev server: `pnpm -w dev`
3. Navigate to Logic Playground (http://localhost:5173)
4. Verify:
   - No `getSnapshot should be cached` warning
   - No `Maximum update depth exceeded` error
   - App loads cleanly and remains stable for 60+ seconds
   - No render storms in console

## Files Changed

- `packages/rb-utils/src/zustand.ts`: Fixed `useStore` hook (lines 20-52)

## Next Steps

**DO NOT PUSH** until Connor verifies locally:
1. Logic Playground loads without errors
2. All interactive features work (toolstrip, canvas, palette)
3. No performance degradation
4. No new console warnings

After verification, merge to `main` via:
```bash
git checkout main
git merge fix/logicplayground-snapshot-loop
git push origin main
```
