# Design Surface — Interaction Contract

> This document is the authoritative source of truth for how the RedByte design canvas
> behaves. Every feature phase in the design-builder overhaul must conform to these rules.
> When a new interaction is added, update this document first.

---

## Core Principle

**One mode at a time. Every mode has an obvious exit.**

Students must always know:
- What happened
- What is wrong
- What to do next
- What is selected
- What mode they are in
- How to cancel

---

## Interaction Modes

There are exactly six named modes. Modes never stack. Entering one mode always fully exits the previous one.

| Mode | How to Enter | How to Exit / Cancel |
|------|-------------|----------------------|
| **Select** (default) | App start; click empty canvas; press Esc from any mode | — (always available as fallback) |
| **Wire** | Click an output port | Press Esc; right-click; complete a valid connection |
| **Placement** | Drag a gate from the palette | Drop on canvas = place; press Esc = cancel with no placement |
| **Rename** | Double-click a node's label area | Press Enter to confirm; press Esc or blur to discard |
| **Trace** (fanin/fanout) | Click a port while in Select mode | Click anywhere else on canvas; press Esc |
| **Macro Place** | Click a macro/subcircuit in the palette | Drop on canvas = place; press Esc = cancel |

### Mode state location

`toolMode` and `interactionMode` in `useLogicViewStore` are the single source of truth.
No component may maintain a shadow copy of mode state.

---

## Select Mode Rules

- Left-click a node → select it (replaces current selection)
- Left-click a node + Shift/Ctrl → add to / remove from selection
- Left-click empty canvas → clear selection (does not trigger any other action)
- Drag on empty canvas → begin marquee (box-select); release finalizes selection
- Delete / Backspace with selection → delete selected nodes and wires (with undo)
- Right-click → context menu (future); no-op today (must not crash)

---

## Wire Mode Rules

- Entry: user clicks an output port. A ghost wire follows the cursor.
- Valid targets: input ports that accept a connection. They glow **green**.
- Invalid targets: already-connected inputs, same-node ports, wrong direction. They show **red** with a tooltip explaining *why* — visible **before** the user releases.
- Releasing on a valid port → create connection, return to Select mode.
- Releasing on empty canvas or an invalid port → cancel wire, return to Select mode.
- Pressing Esc at any point → cancel wire, return to Select mode.
- Right-click during wiring → cancel wire, return to Select mode.
- A wire creation must never create duplicate connections or self-loops (enforced by `wireValidation.ts`).

---

## Placement Mode Rules

- Entry: user drags a gate from the palette OR clicks a palette item.
  - Drag: gate ghost follows cursor immediately.
  - Click: gate ghost attaches to cursor; first click on canvas places it.
- Ghost node must be visible at all times during placement.
- Grid snap applies to placement if `snapToGrid` is enabled.
- Dropping on the canvas places the node; the app returns to Select mode with the new node selected.
- Pressing Esc during placement cancels with **no node created**.
- Placement must never orphan a partially-created node in the circuit store.

---

## Rename Mode Rules

- Entry: double-click the label area of any node.
- An inline text input appears in place of the label.
- Enter confirms the new label and returns to Select mode.
- Esc discards changes and returns to Select mode.
- Blur (clicking elsewhere) confirms the new label and returns to Select mode.
- Empty labels are allowed (the node reverts to its type-based display name).
- Label changes are a circuit mutation and must be captured in undo history.

---

## Trace (Fanin/Fanout) Mode Rules

- Entry: click a port circle in Select mode. Highlights the upstream (fanin) and downstream (fanout) signal path.
- Only one trace is active at a time.
- Clicking any other port replaces the active trace.
- Clicking empty canvas or pressing Esc clears the trace and returns to Select mode.
- Trace is a view-only operation — it never modifies circuit state.
- Trace highlighting is cleared on any circuit mutation.

---

## Macro Place Mode Rules

- Behaves identically to Placement Mode but the palette item is a `CompositeNodeDef`.
- The macro ghost shows the bounding box of the subcircuit footprint.
- Esc cancels with no node created.
- On drop, the macro is instantiated as a single node in the circuit; internal structure is hidden unless the user enters the macro via "Edit Subcircuit."

---

## Interaction Rule Invariants

These must never be violated by any phase of the design overhaul:

1. **No stacked modes.** You cannot be in Wire mode and Rename mode simultaneously.
2. **Esc always works.** Every non-default mode must respond to Esc by returning to Select mode.
3. **No silent drops.** If a placement, connection, or rename is cancelled, the circuit state must be identical to what it was before the mode was entered.
4. **Invalid targets explain themselves.** A port that cannot accept a connection must show a reason before the user releases the mouse — not after.
5. **Selection is never ambiguous.** After any interaction, the set of selected nodes is well-defined and matches the visual highlight state.
6. **Mutations go through the store.** All circuit changes (add node, delete, rename, connect, disconnect) must go through `circuitStore` actions. No component may directly mutate circuit state.
7. **Every mutation is undoable.** All circuit mutations push to `circuitStore.past`. View-only operations (trace, camera pan, zoom) do not.
8. **Canvas click on empty canvas never places a node.** Placement requires an explicit drag-from-palette or palette-click gesture.

---

## Error Feedback Rules

- **Floating outputs** (OUTPUT nodes with no driver): glow red on the canvas; tooltip: "No driver — this output has nothing connected to it."
- **Multiple drivers** on one input port: amber glow; tooltip: "Multiple drivers — only one signal can drive an input port."
- **Unconnected gate inputs**: amber glow; tooltip: "Unconnected input — this pin has no signal."
- Error glows are computed from circuit state after every mutation (`computeDesignIssues`).
- Errors are informational — they do not block simulation or export but are surfaced in the Verify pre-flight check.

---

## Performance Contract

- Mode transitions must complete within one frame (16ms).
- `computeDesignIssues` must complete in <5ms for circuits up to 100 nodes.
- Wire routing (cursor ghost) must update at pointer move rate with no perceptible lag.
- No deep circuit scans may run inside a React render function — use `useMemo` with circuit as dependency.
