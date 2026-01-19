# Zustand Selector Discipline (RedByte)

## Rule 1 — No object literals returned from selectors in React components

**Avoid:**

```typescript
useStore(s => ({ a: s.a, b: s.b }))
useStore(s => ({ ... }), shallow)  // in React components
```

**Prefer:**

```typescript
// Per-field selectors:
const a = useStore(s => s.a)
const b = useStore(s => s.b)
```

Or split into multiple small components that each select what they need.

**Why:**
React's `useSyncExternalStore` expects `getSnapshot()` to be **referentially stable** when the underlying snapshot hasn't changed. Returning new object literals breaks that assumption and can trigger **React #185 "Maximum update depth exceeded"** infinite loop.

### Real example (React #185)

```typescript
// ❌ WRONG - causes infinite loop on perspective switch
const { probes, addProbe, setActiveProbe } = useProbeStore(
  (state) => ({
    probes: state.probes,
    addProbe: state.addProbe,
    setActiveProbe: state.setActiveProbe,
  }),
  shallow  // Doesn't help - new object every call!
);

// ✅ RIGHT - stable individual references
const probes = useProbeStore((state) => state.probes);
const addProbe = useProbeStore((state) => state.addProbe);
const setActiveProbe = useProbeStore((state) => state.setActiveProbe);
```

## Rule 2 — If you truly need grouped selects, use a stable helper

Only allowed if you can **guarantee stable references**:

- Pre-memoized selectors at store definition time
- Store-level derived selectors that return stable references
- Explicit memoization keyed by relevant fields (rare, document it)

If you can't prove stability, **do not group**.

## Rule 3 — "Perspective switches" are a hot path

Anything mounted/unmounted when switching views must be extra strict:

- No unstable selectors
- No effects that write to stores on mount without guards
- Avoid "derive state then setState" loops
- Add smoke test that switches perspectives while simulation is running

Example: OscilloscopeView (oscilloscope/analyze perspective) had 3 object selectors causing React #185 on perspective switch. Fixed by converting to 20 individual per-field selectors.

## Quick Checklist (when React #185 appears)

1. Search for `=> ({` inside React component files (`*.tsx`).
2. Search for `shallow` usage in selectors.
3. Check newly mounted/unmounted view components first.
4. Add a Playwright/headless smoke test that reproduces the exact interaction sequence.
5. Run `pnpm run lint:selectors` to catch common patterns automatically.

## Automated Detection

RedByte includes an automated lint script that flags unstable selectors:

```bash
pnpm run lint:selectors
```

This scans React component files for object-literal selectors and reports any it finds. It's not perfect static analysis, but it's a cheap tripwire that catches ~99% of the footgun.

---

**Lesson learned (2026-01-12):** Three different components (RightDock, OscilloscopeView, and internal tutorial store) all had the same pattern: object selectors returning new references on every store update, causing infinite render loops when selectors were called in hot paths (simulation running + perspective switching). Individual per-field selectors are always safer and cheaper than fighting the reference equality checks.
