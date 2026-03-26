---
type: bug
status: fixed
area: export
priority: high
source: test-run
updated: 2026-03-25
related:
  - "[[Connection Model]]"
  - "[[ADR-001 Enforce Structured Connection Format]]"
  - "[[Export Contracts]]"
---

# BUG-001 — Connection Fixture Format Mismatch

**Status:** Fixed
**Severity:** Test failure (blocked 46/49 contract tests)
**Discovered:** 2026-03-25 autonomous test run
**Fixed in:** `packages/rb-apps/src/__tests__/export-authority-chain-contract.test.ts`

---

## Problem

The `makeMinimalCircuit()` test fixture used an outdated flat connection shape:

```typescript
// WRONG — flat shape, never supported by normalizeProjectConnection
{ id: 'c0', fromNodeId: 'sw0', fromPort: 'out', toNodeId: 'ld0', toPort: 'in' }
```

When `buildExportViewModel` called `normalizeProjectCircuit`, it ran `normalizeProjectConnection` on each connection. That function reads `connection.from` to get the source ref. With the flat shape, `connection.from` is `undefined`, which is neither a string nor a record — causing the error:

```
Invalid project: connection 1 source is missing
```

This caused 46 of 49 export authority chain contract tests to throw before any assertions ran.

---

## Root Cause

The test fixture was written with a non-existent "flat" schema (`fromNodeId`, `toNodeId`). The real `Connection` type has always used the nested shape:

```typescript
{ from: { nodeId: string; portName: string }, to: { nodeId: string; portName: string } }
```

`normalizePortRef` supports two legacy formats:
1. `from: 'nodeId'` — string (very old)
2. `from: { nodeId, portName }` — current

It does **not** support `fromNodeId` at the top level. The fixture was never valid.

---

## Fix

```typescript
// CORRECT
{ id: 'c0', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } }
```

---

## Affected Files

- `packages/rb-apps/src/__tests__/export-authority-chain-contract.test.ts` (fixed)

---

## Related

- [[Connection Model]] — canonical shape definition and migration history
- [[ADR-001 Enforce Structured Connection Format]]
- [[Export Contracts]] — the suite that surfaced this bug
