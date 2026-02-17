# TA Logic Playground Sanity Checklist

## Purpose
Quick pre-lab verification for the classroom IDE interaction contract.

## 60-Second Flow
1. Open Logic Playground in classroom mode.
2. Press **Space** to open Quick Add, place one gate, confirm panel closes.
3. Drag a palette component over canvas, confirm HUD `State` shows `placing`, then returns to `idle` after drop.
4. Drag-select on empty canvas, confirm marquee appears and multiple nodes can be selected.
5. Start wire from an output port:
   - Valid targets glow green.
   - Hovering an invalid target shows red preview.
   - Clicking invalid target does not create a wire.
6. Hold **Space** and drag to pan; scroll to zoom; press **F** fit and **0** reset.
7. Press **Escape** during each active flow (`wiring`, `boxSelecting`, `placing`) and confirm return to `idle`.

## Pass Criteria
- No stuck interaction state.
- No accidental node move while panning.
- No invalid wire committed.
- Fit/reset controls always recover viewport.
