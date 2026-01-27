# RedByte OS Windowing Spec

This spec defines deterministic windowing behavior for RedByte OS.

## Core Rules
- Dragging is direct and smooth. No implicit snapping without user intent.
- Snap actions are deterministic and visible via a preview overlay.
- Every window action (move, resize, snap) is logged in the System Log.

## Snap Assist
Snap Assist controls if/when snap previews appear during dragging.

Modes:
- Off: No snap previews or snapping from drag.
- Manual (Shift): Hold Shift while dragging near edges to show preview.
- Auto (Hover): Hover in a snap zone for 250ms to show preview.

Defaults:
- Mode: Manual (Shift)

## Snap Zones
- Left edge: Snap Left (50% width, full height)
- Right edge: Snap Right (50% width, full height)
- Top edge: Maximize

## Preview + Intent Gating
- Previews appear only when Snap Assist conditions are met.
- Snapping occurs only on mouse release while preview is active.
- Resizing never triggers snap previews.

## Hysteresis
- Enter zone threshold: 24px
- Exit zone threshold: 48px
- Preview remains active until cursor exits the exit zone.

## Logging
- Window moved: log final bounds on drag end.
- Window resized: log final bounds on resize end.
- Window snapped: log target and window id.

## Accessibility + Input
- Shift modifier for manual mode is required during drag.
- Pointer events for previews are disabled (no hitboxes).
- Keyboard snap shortcuts remain available for deterministic layouts.
