# Product hardening: dense-layout net emphasis (2026-04-22)

## Context (Design Phase 13)

Trace **semantics** are strong; **dense** regions (fanout, counters) still force students to visually compete with every other wire. A **separate toggle** would add chrome; the smallest win is **automatic** de-emphasis of **off-path** wires whenever a **path highlight** (`probeWireHighlights`) is active.

## Runtime scenarios (evidence)

| # | Case | Gap | Fix |
|---|------|-----|-----|
| A | Fanout: one driver, many branches | All wires same visual weight | Dim wires **not** in the trace map |
| B | Sequential cluster | Same | Same |
| C | Multi-wire same net | All selected segments in map — not dimmed | — |
| D | “Optional” | No new mode — focus follows active trace | — |

## Blocker register (max 5)

1. **Critical — No visual hierarchy during trace** — **Fixed:** `unrelatedInTraceScope` on `WireView` when `probeWireHighlights` non-empty and wire not on path.  
2. Medium — Even dimmer at very low zoom — deferred.  
3. Lower — Node dimming — out of scope.  
4. Lower — Toggle “emphasis” — avoided (auto only).  
5. Lower — ide-root.css global — used `WireView` `opacity` only.

## Chosen fix

**De-emphasize unrelated wires** (`opacity` ~0.4 on the wire group) when any trace/probe highlight map is active; **exempt** traced path, mismatch, selection, hover, net highlight.

## Files

- `packages/rb-logic-view/src/components/WireView.tsx`  
- `packages/rb-logic-view/src/LogicCanvas.tsx`  
- `packages/rb-logic-view/src/__tests__/trace-focus-dim.test.tsx`  

## Validation

- `pnpm vitest run` (new test + `designSurface.fanout.test.tsx`)  
- `pnpm build:unified`
