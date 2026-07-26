---
doc_status: current
last_validated: 2026-07-25
owner: Connor Angiel
used_by_claude: true
role: sequential model boundary contract
---

# Sequential Support Boundary — RedByte v1

> **Status:** Enforced
> **Last updated:** 2026-07-25
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
| Register1 | Edge-triggered | Rising-edge CLK | Async active-high clear | Generated parity only with active-high enable/clear semantics |
| DLatch | Level-sensitive | N/A (uses EN) | None | Transparent when EN=1, holds when EN=0 |
| RSLatch | Asynchronous | None | None | Cross-coupled NAND SR latch |

### Not Supported

| Pattern | Status | Enforcement |
|---------|--------|-------------|
| Falling-edge-triggered state capture | Blocked | Verify refuses to run; Export emits error |
| Multiple clock domains | Blocked | Verify refuses to run; Export emits error |
| Active-low reset (naming or inversion) | Blocked | Verify refuses to run; Export emits error |
| Synchronous reset | Not available | All reset ports are async in simulation and VHDL |
| RegisterBus or StateBank generated parity | Blocked | May be authored in Design, but Verify and Export block until runtime/VHDL parity exists |
| Register1 falling-edge, active-low, synchronous-clear, preset/set, or unsupported enable/reset configuration | Blocked | Verify and Export emit an explicit unsupported-register diagnostic |

An authored high-to-low transition in a manual/custom Verify row is supported stimulus for this rising-edge model. It holds state; it does not request falling-edge-triggered capture.

### Palette Boundary

The current native sequential palette exposes `Register1`, `RegisterBus`, and `StateBank`; legacy/theory elements remain separately labeled. Palette presence means the element can be placed and inspected. It does **not** promise Verify/Export parity. Only the supported `Register1` configuration above has scalar generated-VHDL parity in this RC. `RegisterBus` and `StateBank` are intentionally blocked at Verify and Export. `Counter4Bit` remains excluded because its old implementation was a non-functional stub.

---

## How Each Surface Enforces the Boundary

### Design Surface

- Native sequential palette entries are Register1, RegisterBus, and StateBank. Legacy/theory sequential elements are grouped separately.
- Counter4Bit is **removed from the palette** because it is a non-functional stub.
- Placement remains available for teaching and inspection; unsupported register families/configurations are caught as explicit Verify and Export blockers.

### Verify Surface

- When `hasUnsupportedTemporal === true`, verify **refuses to run** and surfaces all temporal issues as blocking preflight errors.
- Temporal issues detected:
  - `unsupported-falling-edge`: HDL contains `falling_edge()` or `negedge` patterns
  - `multi-clock-domain`: Multiple distinct clock sources detected
  - `active-low-reset`: Reset signal naming suggests active-low convention
- Manual/custom mode executes the persisted authored rows in stable tick/authored order. A low-to-high clock transition captures rising-edge state; falling, repeated-high, repeated-low, and flat-low rows are settled holds. No synthetic clock or hidden reset is injected.
- Auto mode materializes one sampled row per selected cycle. Runtime internally lowers then raises the resolved clock for each row, and each report row/generated assertion is the post-rising-edge sample. When automatic reset applies, cycle 0 carries reset `1` and later cycles carry reset `0`.
- Sample point is `post-rising-edge` for Auto and `settled-step` for manual/custom rows. State accumulates across the normalized execution plan from a deterministic zero initial state.
- Sequential expectation mismatches are treated as Verify-authoring-or-timing issues first, not automatically as Design failures. The current Verify contract is:
  - unsupported temporal structure → block Verify and send the student back to Design
  - stale sequential evidence → show `STALE` and require rerun / recapture, never reuse FAIL wording
  - live clocked expectation mismatch → keep the student in Verify with explicit `Edit expected outputs` recovery, while still allowing `Open in Design` as a secondary path when circuit logic may be wrong
- Sequential mismatch guidance must speak in tick and edge language. The explanation layer should direct the student to inspect clock, reset, and enable alignment around the failing tick.

### Export Surface

- Export validation checks (`validateClockResetContract`):
  - **Error** if sequential circuit has no clock signal bound
  - **Error** if multiple clock domains detected
  - **Error** if active-low reset via NOT gate inversion
  - **Error** if verify schedule has unsupported temporal issues (falling-edge-triggered capture, multi-clock, active-low reset)
  - **Warning** if multiple reset sources detected
- VHDL generation produces `rising_edge(clk)` only for supported rising-edge primitives/configurations; unsupported register families/configurations block before package generation.
- Manual/custom testbench generation emits the authored clock value for every execution row and uses deterministic settle waits. Auto retains a free-running clock process and waits for the rising edge before each row assertion.
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
- **Source:** A resolved project clock input. Auto mode drives its cycle plan internally; manual/custom mode drives the authored clock lane.
- **Frequency:** 100 MHz when using Basys3 W5 oscillator.

### Reset

- **Polarity:** Active-high only (`rst = 1` asserts reset).
- **Timing:** Asynchronous (takes effect regardless of clock state).
- **Convention:** Reset port names `RST`, `CLR`, `RESET` are recognized. Names matching `reset_n`, `rst_n`, `nreset`, `nrst` are flagged as unsupported active-low convention.

---

## What "Pass" Means for Sequential Circuits

A sequential Verify run passes when **all asserted output values match simulation output on the normalized execution plan**, with state carrying forward in stable tick/authored order.

- Manual/custom rows drive their authored clock/reset/input values directly and sample the settled row; only an authored low-to-high transition captures rising-edge state.
- Auto rows execute the same materialized cycle/reset plan used by generated `testbench.vhd` and `EXPECTED_IO.json`, and sample after the row's rising edge.
- Unasserted outputs (blank expected values) are never compared and cannot cause failure.
- A run with no assertions produces a `TRACE` result (waveform only, no pass/fail judgment).
- A stale result (circuit hash changed since run) shows `STALE` status.

---

## Evidence Sources

| Claim | File | Lines |
|-------|------|-------|
| Rising-edge only in simulation | `rb-logic-core/src/builtins.ts` | 287, 313, 340 |
| Manual/Auto execution materialization | `apps/ide/verifyClockPolicy.ts` | `materializeVectorsForClockPolicy` |
| Falling-edge temporal issue | `basys3/verifySchedule.ts` | 186-201 |
| Multi-clock temporal issue | `basys3/verifySchedule.ts` | 203-218 |
| Active-low reset temporal issue | `basys3/verifySchedule.ts` | 220-236 |
| Verify blocks on temporal issues | `sim/simEngineCore.ts` | 332-334 |
| Export blocks on multi-clock | `basys3ExportService.ts` | 825-832 |
| Export blocks on NOT-gate reset | `basys3ExportService.ts` | 843-854 |
| VHDL rising-edge and register boundary | `export/vhdlExport.ts`, `fpga/boards/basys3/verifySchedule.ts` | generated primitive/configuration guards |
| Counter4Bit is a stub | `rb-logic-core/src/composite-defs.ts` | 264-289 |
