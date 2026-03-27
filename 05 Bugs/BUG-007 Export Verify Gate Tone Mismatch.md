---
type: bug
status: closed
area: export
priority: high
updated: 2026-03-26
related:
  - "[[Test Infrastructure]]"
  - "[[Export Contracts]]"
---

# BUG-007 Export Verify Gate Tone Mismatch (Stale-After-Pass)

## Symptom

When a student has a passing Verify run and then modifies the circuit, the Verify gate row in the Export surface shows:

- Pill tone: `'error'` → renders as red "NEEDS FIX"
- Detail text: "Stale — design changed"

This tells the student they have an error they must fix before downloading. In reality, download is fully allowed. The stale state is advisory.

## Root cause

`ExportSurface.tsx:332-334`:

```typescript
: verifyResult?.status === 'pass' && dirtySinceVerify
  ? 'error' as const
```

The gate tone for `stale-after-pass` is hardcoded to `'error'`. The gate row renderer maps `'error'` tone to "NEEDS FIX" label.

## Contradiction with existing code

`ExportSurface.tsx:260-263` JSDoc explicitly states:
> "Download is allowed but labeled as previous sealed build — not blocked."

The `isStaleButPassBefore` variable at `ExportSurface.tsx:262-266` handles this case more gently everywhere else in the surface. The gate row is the only place that treats it as 'error'.

## Fix

Change `'error' as const` to `'warn' as const` at `ExportSurface.tsx:332-334`.

The gate row renderer already handles `'warn'` → renders yellow "STALE" pill, which is the correct signal.

## Impact

This is the most common mid-lab path: student iterates on circuit after passing Verify. Every student in this state sees a false red "NEEDS FIX" block.
