# Product hardening: multi-wire selection net story (2026-04-22)

## Context (Design Phase 11)

Single-wire selection auto-traces one driver net and uses student-facing trace copy. **Multiple selected wire segments** were only counted (“N wires”) with a generic “narrow to one net” line—students could not see whether those segments are **one signal or several** or whether the UI matched what the canvas was highlighting. A **stale** auto net trace could also remain in the title bar after adding a second wire.

## Runtime scenarios (evidence)

| # | Case | Student question | Problem | Intent |
|---|------|------------------|---------|--------|
| A | Two branches, same driver | One net or two? | No grouping | Explain **one driver / same net** and list the driver name |
| B | Wires from different sources | How many paths? | Implied a single story | **Multiple signals** + list each driver |
| C | Fanout jumble | What did I select? | Trace banner vs selection mismatch | **Clear trace** on multi-select (verify/debug excepted) |
| D | Wires + later node | (Out of order in inspector) | Node wins first; OK | — |

## Blocker register (max 5)

1. **Critical — No one-net vs many-nets readout** for multi-select  
   **Action:** `summarizeMultiWireNetSelection` by driver (from-end of each edge, consistent with one-net auto-trace) + headline + detail + `Signal groups:` line.

2. **High — Stale trace while multi-wires selected**  
   **Action:** `clearTrace()` when `wires > 1` and no nodes, unless verify/debug own the trace.

3. **Medium — “N wires” capped at 5 in some UI**  
   **Action:** `selectedWireIdsAll.length` in multi-wire count and properties strip.

4. **Lower — Canvas highlight still per-segment** (no merged glow)  
   Defer: visual only.

5. **Lower — `describeNodeConnectionSummary` “upstream sources”** copy  
   Out of scope.

## Chosen fix (this slice)

**#1 and #2 together** (one product pass): explain **distinct driver count** in plain language and **reset trace** so the title bar and teaching copy stay aligned.

## Files

- `DesignSurface.tsx` (summary helper, `multiWireNetSummary` useMemo, clear effect, identity card, wire count in strip)

## Validation

- `designSurface.multiWireNet.test.tsx`
- `pnpm build:unified`
