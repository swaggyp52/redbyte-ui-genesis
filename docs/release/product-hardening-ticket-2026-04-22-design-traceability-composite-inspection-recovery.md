# Product Hardening — Design traceability + composite inspection (2026-04-22)

## Ticket

- **Title:** PHASE 8 — Design traceability + composite inspection recovery
- **Date:** 2026-04-22
- **Surface:** IDE → Design (canvas, selection, net tracing)
- **Disposition:** Fixed in local slice (auto wire-net trace on single wire selection; see commit)

## Runtime scenarios (evidence)

| Scenario | Path | Student goal | Finding | Top gap |
|----------|------|----------------|--------|--------|
| **A** | `currentMode === 'design'`, `designView` canvas | Follow a signal from driver to load(s) | Inspector shows `sourceLabel` → `targetLabel` for one **segment**; full **fanout** from the driver required an extra **Trace net** click | **Selection alone did not reveal the whole net** on canvas |
| **B** | Dense / overlapping | See which net is which | Wire stroke + selected state exist; without net-level highlight, **competing** segments stay ambiguous for fanout | **Fanout** needs simultaneous emphasis |
| **C** | Composite / macro (palette / focus inspector) | Understand block semantics | `DesignFocusInspector` gives interface; deep internals are separate work | Defer: structural disclosure for composites |
| **D** | Select gates vs wires | Legibility of relationships | Port trace and fanout buttons work but are **opt-in** | **Auto-trace on wire** reduces opt-in burden |

## Blocker register (max 5)

1. **Severity: high** — Selecting a wire does not automatically highlight **all segments** sharing the same driver (fanout net). *Action: auto-apply `wire-net` trace on single wire selection when verify/debug is not driving trace.*
2. **Severity: medium** — Composite / conglomerate **internal** view still not first-class. *Defer.*
3. **Severity: medium** — Command strip / meta density during trace. *Defer.*
4. **Severity: low** — Port-level fanin label uses raw `portKey` in some labels. *Defer.*
5. **Severity: low** — 3D / split design views alignment. *Defer.*

## Chosen fix

**#1** — Auto net trace on single wire selection (teaching: “what is connected to this driver?” without an extra control click).

## Validation

- `pnpm --filter @redbyte/rb-apps exec vitest run src/apps/ide/__tests__/designSurface.fanout.test.tsx`
- `pnpm build:unified`

## Follow-up (2026-04-22 — polish campaign)

- Identity card: remove redundant **Type** kv-row when `Part · type` already carries the friendly type; keep `ide-design-selection-type` on the subtitle type span.
- Eval order: relabel **Fanout** to student-facing **Outgoing connections** (numeric `ide-design-fanout` unchanged).
- Live summary: when workspace health shows the full trace sentence, **Trace state** in the dock shows **Active** + tooltip instead of duplicating the same sentence.

## Attribution

Connor Angiel
