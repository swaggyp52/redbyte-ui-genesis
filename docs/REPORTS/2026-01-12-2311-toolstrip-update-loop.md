# CircuitToolStrip update-loop fix

Loop chain:
- `SplitViewLayout` measures the container and calls `setDimensions(...)`.
- When size is unchanged but a new object is set, the component re-renders and the `setCircuitViewSize(dimensions)` effect runs again.
- The view state store update triggers another render, repeating the cycle and surfacing as a max update depth error while `CircuitToolStrip` is on screen.

Fix:
- `packages/rb-apps/src/components/SplitViewLayout.tsx:154-166` now guards `setDimensions` so it only updates when width/height change.
- This prevents redundant dimension updates and stops the render → store update → render loop.

Repro steps (before):
1) Run the dev server.
2) Navigate to Logic Playground (Circuit view).
3) Observe repeated renders and the “Maximum update depth exceeded” error pointing to `CircuitToolStrip`.

Repro steps (after):
1) Run the dev server.
2) Navigate to Logic Playground.
3) Confirm the error is gone; leave it idle for 30 seconds.

Verification: not run here (no browser available in this environment).
