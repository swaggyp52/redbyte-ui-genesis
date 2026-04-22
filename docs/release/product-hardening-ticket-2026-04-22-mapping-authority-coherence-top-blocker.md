# Product Hardening Ticket — Mapping authority coherence (Phase 3)

## Ticket

- **Title:** Hardware Map Pins readiness vs Export/Project when no output rows
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Hardware (`HardwareSurface.tsx`), shared `projectIoRows` / export viewmodel
- **Journey segment:** Map Pins → Hardware dock → Export readiness
- **Environment:** Playwright + `vite preview` (Chromium); Vitest `hardwareSurface.readiness.test.tsx`
- **Linked GitHub issue:** (none)

## Runtime mapping scenarios used

| Scenario | Route | What we checked | Result (pre-fix) |
|----------|-------|-----------------|------------------|
| **A — Incomplete** | Starter with unmapped pins → Project / Hardware / Export | Surfaces disagree on counts only when export-only required ports missing (`missingRequiredPortsFromExport`) | Already aligned via IdeApp |
| **B — Partial** | Map subset of pins | Dock shows `N left`; Export gate shows mapping gap | Consistent |
| **C — Complete (typical)** | All inputs + outputs mapped | Hardware **Complete**; Export I/O gate ok | Consistent |
| **D — Inputs-only boundary** | Combinational (or degenerate) fixture: **only `in` rows** in `projectIoRows`, all pins set, `exportRequiredMappingGapCount === 0` | Project/Export treat I/O as satisfied; Hardware Map Pins dock | **Bug:** dock showed **`0 left`** (not **Complete**) because `hasOutputMapping` required `requiredOutputs.length > 0` |

## Narrow blocker register

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| **SEV-2** | Hardware Map Pins shows **“0 left”** but not **Complete** when there are **no output rows** | Student finishes mapping all **inputs**; Export/Project say mapping is fine | Map dock pill: `mappingReady` false → `` `${unresolvedRequiredCount} left` `` with count **0** | `hasOutputMapping` used `requiredOutputs.length > 0 && …`; empty list made the conjunct **false** | **Contradictory readiness** vs Export/Project; feels blocked with no work left | Treat **no required outputs** as **N/A / satisfied** for output mapping |

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-3 | Dual editors (Project table vs Hardware Map) | Map in either place | Same `setMappingPin` | Product pattern | Cognitive load | Future UX slice; out of scope |

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-3 | `liveScheduleContract` in IdeApp uses flat `ioMapping` only | Timing / clock classification edge cases | Code review vs `resolveIoMappingFromProjectFields` | Theoretical drift when V2 empty | Low frequency | Harmonize in a schedule-focused slice if proven |

## Chosen top blocker (this slice)

**SEV-2 — `hasOutputMapping` falsifies Hardware `mappingReady` when the design has no required output mapping rows**, producing **“0 left”** instead of **Complete** while **Export** / **Project** already treat mapping as satisfied for export.

## Root cause

```416:424:packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx
  const hasOutputMapping = useMemo(
    () => {
      const requiredOutputs = mappingRows.filter(
        (row) => row.direction === 'out' && row.required
      );
      return requiredOutputs.length > 0 && requiredOutputs.every((row) => row.pin.trim().length > 0);
    },
    [mappingRows]
  );
```

Vacuous case: `requiredOutputs.length === 0` → expression short-circuits to **false** → `mappingReady` never reaches **true** even when `unresolvedRequiredCount === 0`.

## Fix (this slice)

- If there are **no required output rows**, treat output mapping as **satisfied** (same idea as clock mapping when board oscillator is N/A for lab timing).

## Acceptance proof

- New Vitest: inputs-only + combinational timing guidance → Map dock contains **Complete**.
- `pnpm --filter @redbyte/playground build` and `pnpm build:unified` pass.

## Disposition

- **Status:** fixed in slice
- **Fix PR / commit:** on `main` (hash recorded in git log at push time)

## Attribution

Connor Angiel
