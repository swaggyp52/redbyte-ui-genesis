---
type: bug
status: fixed
area: export
priority: high
source: manual-debug
updated: 2026-03-30
related:
  - "[[Basys 3 Mapping]]"
  - "[[Export Contracts]]"
---

# BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers

## Summary

Basys3 export could turn student labels such as `RST (BTNC)` into `RST__BTNC_`, which is not a legal VHDL basic identifier and caused Vivado synthesis to fail on otherwise valid exported designs.

## Root Cause

The Basys3 top-port sanitizer only replaced non-alphanumeric characters with underscores. It did not collapse repeated underscores, trim trailing separators, or ensure the resulting identifier began with a letter before that name was used in `top.vhd` and `top.xdc`.

## System Truth

Any student-facing label that becomes a Basys3 entity or XDC port name must be normalized into a real VHDL basic identifier before artifact emission. Legal export names cannot depend on Vivado tolerating repeated, trailing, or digit-leading underscore forms.

## Fix

- Hardened Basys3 identifier sanitization to collapse repeated separators, trim edge underscores, and prefix non-letter-leading identifiers.
- Updated regression tests so labels like `my-signal!` export as `my_signal` and `RST (BTNC)` exports as `RST_BTNC`.
- Reproved the shipped `two-bit-counter` example in real Vivado after regeneration; synthesis and `route_design` now complete.

## Links

- [[Basys 3 Mapping]]
- [[Export Contracts]]