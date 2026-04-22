# Product hardening: trace toast / chrome reduction (2026-04-22)

## Context (Design Phase 12)

Trace **meaning** is strong (banners, multi-wire copy, student labels). Manual **“Trace net”** on a wire also fired `setActionToast('Net trace: all branches...')` while `traceState.label` already said the same story in the **active trace** pill and the **inspector** “Trace state” row — **duplicative, transient noise** after the student already has persistent chrome.

## Runtime scenarios (evidence)

| # | Flow | Issue |
|---|------|--------|
| A | First manual trace on a wire | Toast repeated confirmation already in `traceState.label` |
| B | Repeated trace clicks | Each manual apply could have stacked perception of “something else happened” (toast) |
| C | Auto-trace + manual | Both silent or toast only on manual — inconsistent; removing toast **aligns** manual with auto (highlight + label only) |
| D | Block + trace | Title bar + inspector already compete; removing toast **reduces** one layer |

## Blocker register (max 5)

1. **Critical — Redundant manual-trace action toast**  
   **Action:** Remove `setActionToast` in `applyWireNetTraceForWireId` for `origin === 'manual'`.

2. **Medium — `workspaceRuntimeLabel` “Trace” + titlebar stat** — same word twice; out of this slice (titlebar is primary).

3. **Lower — Trace state in dock KV + titlebar** — optional consolidation later.

4. **Lower — Auto-dismiss toast timing (1.8s) for *other* toasts** — unchanged.

5. **Lower — Split workspace sim strip** — out of scope.

## Chosen fix (this slice)

**#1** only — one product rule: **persistent trace chrome is the confirmation;** no second transient toast for the same action.

## Files

- `DesignSurface.tsx` (comment + remove toast)
- `designSurface.fanout.test.tsx` (assert no redundant toast)

## Validation

- Focused vitest + `pnpm build:unified`
