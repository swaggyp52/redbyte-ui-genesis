# Phase 1C Smoke Checklist (State + Performance)

Goal: confirm RedByte OS + key lab surfaces run without runaway renders, leaked loops, or obvious performance regressions.

This checklist is intentionally manual and fast (~10 minutes). It complements automated gates (build + determinism gates) and is designed to be repeatable before a lab/class session.

## Last Validated (fill in when run)

- Date: (YYYY-MM-DD)
- Commit: (git SHA)
- Browser: (Chrome/Edge/Firefox + version)
- Result: PASS / FAIL

## Setup

1. Start the OS (dev server or preview build).
2. Open DevTools Console.
3. Enable render storm reporting (dev-only):
   - Run: `localStorage.setItem('rb:renderStormReport', '1')`
   - Reload the page.

Expected: the console periodically prints `[render-storm:top]` summaries and emits `[render-storm]` warnings only if a threshold is exceeded.

Alternative (no DevTools driving): add `?p1c=1` to the OS URL. This triggers a small automated open/mutate/close flow and prints a single `[render-storm:report]` JSON blob.

Optional (recommended): mark step boundaries + generate a single report artifact at the end:
- Step marker: `window.__RB_RENDER_STORM_API__?.markStep('os-idle')`
- Final report: `window.__RB_RENDER_STORM_API__?.finalize()` (also assigns `window.__RB_RENDER_STORM_REPORT__`)

## Checklist

### 1) OS Boot Idle (baseline)

1. From a fresh reload, do nothing for 10 seconds.
2. (Optional) Run: `window.__RB_RENDER_STORM_API__?.markStep('os-idle')`
3. Observe `[render-storm:top]` output.

Pass:
- No `[render-storm]` warnings while idle.
- Top offenders are stable (no “runaway” component rapidly climbing forever).
- If using the report: `window.__RB_RENDER_STORM_REPORT__?.passReasons?.warnings === true`.

### 2) Logic Playground Interaction

1. Open Logic Playground.
2. Place 5–10 components and wire them.
3. Toggle inputs repeatedly for ~10 seconds.
4. Stop interacting for 5 seconds.
5. (Optional) Run: `window.__RB_RENDER_STORM_API__?.markStep('logic-playground')`

Pass:
- Interaction can be bursty, but settles back to idle (no sustained `[render-storm]` warnings).
- No React errors like “Maximum update depth exceeded”.
- If using the report: `window.__RB_RENDER_STORM_REPORT__?.passReasons?.warnings === true`.

### 3) ECE Lab Interaction

1. Open ECE Lab.
2. Perform the minimum expected workflow for the current build (open an experiment, interact with the canvas/sim view).
3. Stop interacting for 5 seconds.
4. (Optional) Run: `window.__RB_RENDER_STORM_API__?.markStep('ece-lab')`

Pass:
- No `[render-storm]` warnings during idle.
- No console errors indicating store loops or snapshot loops.
- If using the report: `window.__RB_RENDER_STORM_REPORT__?.passReasons?.warnings === true`.

### 4) Open/Close Cycle (leak check)

1. Close Logic Playground and ECE Lab windows.
2. Wait 5 seconds.
3. Re-open Logic Playground, then close it again.
4. Repeat open/close 3 times.
5. (Optional) Run: `window.__RB_RENDER_STORM_API__?.markStep('open-close-cycle')`

Pass:
- No baseline drift upward in `[render-storm:top]` after repeated open/close cycles.
- No continuing “tick” / simulation activity after windows are closed (no ongoing logs tied to closed apps).
- If using the report: `window.__RB_RENDER_STORM_REPORT__?.passReasons?.leaks === true` and `window.__RB_RENDER_STORM_REPORT__?.leaks?.delta` returns to `{ intervals: 0, timeouts: 0, rafs: 0 }`.

## Recording Results

For a stability milestone (or before a lab session), record:
- Date/time, commit hash (if available)
- PASS/FAIL for each section
- Notes on any `[render-storm]` warnings (include the top-offenders output and the interaction that triggered it)

If using the report emitter:
- Run: `window.__RB_RENDER_STORM_API__?.finalize()` and paste the emitted `[render-storm:report]` object into `AI_STATE.md` notes for the run.

## Disable Reporting

When finished:
- `localStorage.removeItem('rb:renderStormReport')`

**Attribution:** Connor Angiel
