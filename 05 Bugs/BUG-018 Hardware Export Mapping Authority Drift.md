---
type: bug
status: fixed
area: hardware
priority: high
source: manual-debug
updated: 2026-04-14
related:
  - "[[Hardware Surface]]"
  - "[[Export Contracts]]"
  - "[[Basys 3 Mapping]]"
---

# BUG-018 Hardware Export Mapping Authority Drift

## Summary

Hardware and Export could show mapped visible rows while still blocking on hidden required-port gaps, and blank/custom projects could enter Hardware on the wrong mode with no actionable mapping path.

## Root Cause

Three naming authorities had drifted apart:

- Hardware map readiness relied on local mapping-row presence and timing assumptions, even when Export still reported required unmapped top-level ports
- Export row editability and pin overrides keyed from saved mapping labels or ids instead of the same live row names rendered in the visible pin table
- entity-based testbench generation did not treat Basys3 binding-ref aliases as equivalent to sanitized export names, so labels such as `RST (BTNC)` could fail to resolve back to the same exported row and entity ref

That drift made the UI contradict itself: a student could see `5/5` or `0 left` while still being blocked by a missing port they could not edit from the current surface.

## System Truth

One mapped boundary row must have one shared alias family across Hardware, Export, validation, XDC, and testbench generation. The live visible row name and the Basys3 binding refs (`portName`, `signalRef`, `xdcRef`) are the cross-surface authority. Blank/custom projects with no boundary rows must still land in `Map Pins` mode with Design-first guidance, and combinational designs with no required timing-control row must not be treated as clock-missing.

## Fix

- Export validation now accepts binding-ref-derived aliases when satisfying required ports.
- Export row editability and pin overrides now key from the same live row naming authority the student sees in the pin table.
- Hardware now defaults blank/custom projects to `Map Pins`, shows a Design-first empty state, and includes export-required missing ports in map readiness.
- Combinational map readiness no longer blocks on a nonexistent timing-control row.
- Entity-based testbench generation now resolves targets through the same Basys3 binding refs used by exported artifacts.

## Links

- [[Hardware Surface]]
- [[Export Contracts]]
- [[Basys 3 Mapping]]