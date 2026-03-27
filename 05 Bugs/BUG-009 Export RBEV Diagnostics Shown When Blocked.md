---
type: bug
status: closed
area: export
priority: medium
updated: 2026-03-26
related:
  - "[[Export Contracts]]"
---

# BUG-009 Export RBEV Advisory Diagnostics Shown When Export Is Blocked

## Symptom

When export is blocked by a hard RBEX error (e.g. RBEX1001 — unmapped required port), the diagnostics list also shows RBEV advisory warnings (e.g. RBEV1000 — "No comparison run found"). This mixes actionable blockers with irrelevant advisories.

The section header changes to "Blockers" dynamically, but the list below it still contains both categories.

## Root cause

`ExportSurface.tsx:165-168`:
```typescript
const diagnosticsList = [...viewModel.errors, ...evidenceDiagnostics, ...viewModel.warnings]
```

RBEV `evidenceDiagnostics` are always appended regardless of whether `hasBlockingErrors` is true. They are not gated by block state.

## Fix

Filter `evidenceDiagnostics` from `diagnosticsList` when `hasBlockingErrors` is true:

```typescript
const diagnosticsList = [
  ...viewModel.errors,
  ...(!hasBlockingErrors ? evidenceDiagnostics : []),
  ...viewModel.warnings,
]
```

No state or pipeline changes required.
