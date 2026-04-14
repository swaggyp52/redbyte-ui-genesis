---
type: bug
status: open
area: vivado
priority: medium
source: implementation
updated: 2026-04-14
related:
  - "[[Hardware Surface]]"
  - "[[Export Contracts]]"
  - "[[BUG-018 Lab Hardware Strict Readiness Blocked by Missing djtgcfg]]"
---

# BUG-019 VHDL Export Unused Vector Bits Block Bitstream

## Summary

The VHDL export pipeline emits full-width packed vectors (`SW : in STD_LOGIC_VECTOR(8 downto 0)`, `LED : out STD_LOGIC_VECTOR(1 downto 0)`) but only constrains the bits that appear in the `ioMapping`. Unused bits (e.g. `LED[0]`, `SW[0..3]`, `SW[7..8]`) have no `IOSTANDARD` or `LOC` in the generated XDC, which causes Vivado DRC checks `NSTD-1` and `UCIO-1` to fail as errors and block `write_bitstream`.

## Root Cause

`basys3Bundle.ts` sizes entity ports by the largest index referenced in the `ioMapping` (e.g. `SW[6]` → `SW[8:0]`, `LED[1]` → `LED[1:0]`), then `buildTopXdc` only emits constraints for the mapped bits. The remaining bus bits are synthesized as floating/GND-tied but are still present as visible ports in the netlist, so Vivado's DRC checker demands constraints for them.

Vivado DRC checks triggered:
- `NSTD-1` — port has no IOSTANDARD constraint
- `UCIO-1` — port has no LOC (unconstrained I/O)
- `BIVC-1` — bus members have inconsistent I/O voltage standards

## System Truth

For bitstream generation to succeed without DRC overrides, every bit of every entity port present in the synthesized netlist must have both a `LOC` and an `IOSTANDARD` constraint in the XDC, OR the unused bits must be optimized away (tied to GND/VCC and removed from the port list before P&R).

## Fix

**Workaround applied (2026-04-14):** `out/lab8/write_bitstream.tcl` opens the completed `impl_1` routed checkpoint and downgrades NSTD-1, UCIO-1, and BIVC-1 to `Warning` before calling `write_bitstream -force`. This unblocked bitstream generation for Lab 8 without modifying the export pipeline.

**Proper fix needed in export pipeline:** One of:
1. Emit scalar ports (`SW4 : in STD_LOGIC`, `SW5 : in STD_LOGIC`, etc.) instead of packed vectors when the ioMapping references a sparse subset of a logical bus — eliminates unconstrained bits entirely.
2. Add a dummy XDC `set_property PACKAGE_PIN` and `IOSTANDARD LVCMOS33` constraint for every unused vector bit, using safe unused pins on the target board.
3. Pad the ioMapping internally to cover all bits in the emitted vector range before generating the XDC.

Option 1 is the cleanest and removes the underlying mismatch. Options 2–3 are workarounds that preserve the current vector packing behavior.

## Links

- [[Hardware Surface]] — hardware deployment context
- [[Export Contracts]] — VHDL/XDC generation pipeline
- `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts` — vector sizing logic
- `packages/rb-apps/src/fpga/boards/basys3/basys3ExportModel.ts` — XDC constraint emission
- `out/lab8/write_bitstream.tcl` — active workaround (DRC severity downgrade)
