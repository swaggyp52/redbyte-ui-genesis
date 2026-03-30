---
type: bug
status: fixed
area: vivado
priority: critical
source: manual-debug
updated: 2026-03-30
related:
  - "[[Basys 3 Mapping]]"
  - "[[Export Contracts]]"
---

# BUG-012 Basys3 Switch and Button Clock Buffer Inference

## Summary

Basys3 sequential exports driven by switch or button control nets could synthesize, then fail Vivado implementation with `Place 30-574` because synthesis inserted a BUFG on a non-CCIO `SW` or `BTN` pin.

## Root Cause

The Basys3 XDC generator treated `CLOCK_BUFFER_TYPE NONE` as a latch-only special case. That left other switch/button-controlled paths free for Vivado to classify as clock-like and route through BUFG insertion, which is illegal on Basys3 non-CCIO switch pins.

## System Truth

On Basys3, switch and button ports are control inputs, not dedicated clock sources. Export must always mark those ports with `CLOCK_BUFFER_TYPE NONE`, and only the real oscillator input (`CLK100MHZ` / `W5`) should receive clock constraints and buffer treatment.

## Fix

- Generalized `buildTopXdc(...)` so every switch and button input port emits `set_property CLOCK_BUFFER_TYPE NONE ...`, independent of design classification.
- Added regression coverage for combinational and sequential-clocked XDC outputs to pin the generalized policy.
- Proved the generalized rule in real Vivado with routed implementations for `signal-tour`, `DLatch`, `DFF`, `TFF`, and `JKFF` switch-driven cases.

## Links

- [[Basys 3 Mapping]]
- [[Export Contracts]]