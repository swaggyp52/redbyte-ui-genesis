# Sequential Support Boundary — RedByte v1

> **Status:** Enforced
> **Last updated:** 2026-04-01
> **Applies to:** Design, Verify, Export, Hardware surfaces

---

## Supported Sequential Model

RedByte v1 supports a **single-clock, rising-edge, active-high-reset** sequential model.

### Supported Primitives

| Primitive | Type | Clock | Reset | Behavior |
|-----------|------|-------|-------|----------|
| DFlipFlop | Edge-triggered | Rising-edge CLK | Async active-high RST | Captures D on 0→1 CLK transition |
| TFlipFlop | Edge-triggered | Rising-edge CLK | Async active-high CLR | Toggles Q when T=1 on rising edge |
| JKFlipFlop | Edge-triggered | Rising-edge CLK | Async active-high CLR | Standard JK truth table on rising edge |
| DLatch | Level-sensitive | N/A (uses EN) | None | Transparent when EN=1, holds when EN=0 |
| RSLatch | Asynchronous | None | None | Cross-coupled NAND SR latch |

### Not Supported

| Pattern | Status | Enforcement |
|---------|--------|-------------|
| Falling-edge triggers | Blocked | Verify refuses to run; Export emits error |
| Multiple clock domains | Blocked | Verify refuses to run; Export emits error |
| Active-low reset (naming or inversion) | Blocked | Verify refuses to run; Export emits error |
| Synchronous reset | Not available | All reset ports are async in simulation and VHDL |

### Removed from Palette (v1)

| Component | Reason |
|-----------|--------|
| Counter4Bit | Stub implementation — internals are Switches, not flip-flops. Will be restored when properly implemented. |

---

## How Each Surface Enforces the Boundary

### Design Surface

- Sequential primitives are available in the palette (DFF, TFF, JKFF in "Sequential & Timing"; DLatch, RSLatch in "Reusable Blocks").
- Counter4Bit is **removed from the palette** because it is a non-functional stub.
- No placement restrictions — unsupported patterns are caught downstream by Verify and Export.

### Verify Surface

- When `hasUnsupportedTemporal === true`, verify **refuses to run** and surfaces all temporal issues as blocking preflight errors.
- Temporal issues detected:
  - `unsupported-falling-edge`: HDL contains `falling_edge()` or `negedge` patterns
  - `multi-clock-domain`: Multiple distinct clock sources detected
  - `active-low-reset`: Reset signal naming suggests active-low convention
- When verify runs, the clocked macro sequence is `[0, 1, 0]` (setup → rising edge capture → post-edge stabilization).
- Sample point is `post-rising-edge`. State accumulates across vectors.
- If no external clock is mapped, sim clock injection provides a synthetic `__sim_clk__` node.

### Export Surface

- Export validation checks (`validateClockResetContract`):
  - **Error** if sequential circuit has no clock signal bound
  - **Error** if multiple clock domains detected
  - **Error** if active-low reset via NOT gate inversion
  - **Error** if verify schedule has unsupported temporal issues (falling-edge, multi-clock, active-low reset)
  - **Warning** if multiple reset sources detected
- VHDL generation always produces `rising_edge(clk)` for edge-triggered primitives.
- DLatch generates level-sensitive `if en = '1' then` — no clock constraint emitted.
- XDC emits `create_clock -period 10.000` (100 MHz) for W5 pin only.

### Hardware Surface

- IO mapping allows CLK100MHZ (W5) as the single clock source.
- No multi-clock pin mapping is offered.

---

## Clock and Reset Contract

### Clock

- **Single domain:** Exactly one clock source per circuit.
- **Edge:** Rising only (`0 → 1`).
- **Source:** Either user-mapped CLK100MHZ (W5) pin or auto-injected sim clock.
- **Frequency:** 100 MHz when using Basys3 W5 oscillator.

### Reset

- **Polarity:** Active-high only (`rst = 1` asserts reset).
- **Timing:** Asynchronous (takes effect regardless of clock state).
- **Convention:** Reset port names `RST`, `CLR`, `RESET` are recognized. Names matching `reset_n`, `rst_n`, `nreset`, `nrst` are flagged as unsupported active-low convention.

---

## What "Pass" Means for Sequential Circuits

A sequential verify run passes when **all asserted output values match simulation output after applying the clocked macro sequence**, with state carrying forward across vectors in order.

- Each vector drives inputs, then executes the 3-tick `[0, 1, 0]` clock macro.
- Outputs are sampled after the post-edge stabilization tick.
- Unasserted outputs (blank expected values) are never compared and cannot cause failure.
- A run with no assertions produces a `TRACE` result (waveform only, no pass/fail judgment).
- A stale result (circuit hash changed since run) shows `STALE` status.

---

## Evidence Sources

| Claim | File | Lines |
|-------|------|-------|
| Rising-edge only in simulation | `rb-logic-core/src/builtins.ts` | 287, 313, 340 |
| CLOCKED_MACRO_SEQUENCE = [0,1,0] | `rb-utils/src/verifySchedule.ts` | 14 |
| Falling-edge temporal issue | `basys3/verifySchedule.ts` | 186-201 |
| Multi-clock temporal issue | `basys3/verifySchedule.ts` | 203-218 |
| Active-low reset temporal issue | `basys3/verifySchedule.ts` | 220-236 |
| Verify blocks on temporal issues | `sim/simEngineCore.ts` | 332-334 |
| Export blocks on multi-clock | `basys3ExportService.ts` | 825-832 |
| Export blocks on NOT-gate reset | `basys3ExportService.ts` | 843-854 |
| VHDL rising_edge generation | `basys3/vhdlExport.ts` | 558, 643, 690 |
| Counter4Bit is a stub | `rb-logic-core/src/composite-defs.ts` | 264-289 |
| Sim clock injection | `rb-logic-core/src/analysis/injectSimClock.ts` | 15-54 |
