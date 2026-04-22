# Product hardening: composite / sequential block inspection (2026-04-22)

## Context

After Design traceability improvements, students can follow nets, but the **identity / inspector** still asked too much prior knowledge: clicking a D flip-flop, gate, or saved block often surfaced **ports and metadata first** while **meaning** (what kind of part this is, whether it is sequential vs combinational, and whether it is a saved macro) was easy to miss.

## Runtime scenarios (evidence)

| Scenario | Student goal | Gap | Evidence |
|----------|--------------|-----|----------|
| A — Sequential (e.g. DFF) | “What is this block doing vs just pins?” | Identity card repeated type; behavior lived mostly in the lower sequential callout | Selection eyebrow did not state **part class** (Sequential) or a one-line “what this is” at the top |
| B — Macro / custom | “Is this composite? Can I open it?” | Description only if student already knew to read palette; inspector thin | No **Saved component** label or structure hint in the focus strip |
| C — After trace | “How does this block relate to the signal?” | Same; trace context + thin identity | Trace improved; **meaning strip** still missing |
| D — First-time | “What should I look at next?” | `nextStep` helpful but not preceded by a clear category | **Primary teaching line** needed above next-step |

## Blocker register (max 5)

1. **Critical — “What is this?” missing at selection top**  
   Workflow: any single-node selection. Root cause: identity card optimized for title + status + next-step, not **taxonomy + one sentence**.  
   **Action:** Add `partKind` + `whatItIs` + optional `structureHint` in the identity card.

2. **High — Custom / saved blocks indistinguishable from primitives in the strip**  
   Workflow: click saved `MyMux`-style part. Root cause: no first-class “saved block” + description surface in selection.  
   **Action (partially bundled):** `Saved` label + custom description in `whatItIs`; structure hint for fixed internals.

3. **Medium — Combinational vs sequential not labeled in the strip**  
   Same fix as (1) for sequential vs combinational; relies on `buildSequentialInspectorContext` for sequential first sentence.

4. **Lower — Demote duplicate type rows**  
   Subtitle now `partKind · typeName`; full Type row kept for reference — optional follow-up to tighten KV list.

5. **Lower (out of scope for this slice) — Multi-selection net / emphasis**  
   Tracked in Design backlog; not addressed here.

## Chosen single fix (this slice)

Implement **#1** with support for **#2** and **#3** via one resolver:

- `resolveNodeInspectionTeachingProfile` → `partKind`, `whatItIs`, `structureHint?`
- UI: `data-testid` hooks `ide-design-inspector-part-kind`, `ide-design-inspector-what-it-is`, `ide-design-inspector-structure-hint`, `ide-design-inspector-meaning`

## Validation

- `designSurface.sequentialInspector.test.tsx` (DFF teaching lines)
- `designSurface.teachingProfile.test.tsx` (AND + custom)
- `pnpm build:unified`

## Files

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- Tests under `packages/rb-apps/src/apps/ide/__tests__/`
