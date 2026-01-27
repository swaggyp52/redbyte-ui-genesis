# RedByte OS Windowing Plan

## PHASE_OS_01 - Snap Assist + Preview (current)
- Replace auto-snap on drag with intent-gated preview.
- Implement snap preview overlay + hysteresis.
- Add Settings ? Windowing ? Snap Assist (Off | Manual | Auto).
- Log window move/resize/snap events.
- Tests: snap gating, preview activation, hysteresis, hover delay.

## PHASE_OS_02 - Presets + Layouts
- Add window presets (maximize/restore, snap, center, full height, PIP).
- Add global layouts (two-column, focus+sidecar, three-column, grid 2x2, cascade).
- Save/restore last layout slot (single slot).
- Tests: layout determinism, viewport clamping, focus/z-index rules.
