# Proof: IDE `two-bit-counter` — Basys3 truth, E1 rebuild, E2 attempt (2026-04-23)

## 1. Problem

Close the **sequential reference row**: board-clock semantics in RedByte, export fidelity, real Vivado **E1**, then **E2/E3** on hardware.

## 2. Root cause (E2 on this session)

**`hw_server` sees zero JTAG targets** on `localhost:3121` (`Labtoolstcl 44-27` / `44-199`). The programming Tcl path is correct (refresh, `get_hw_targets -of_objects`, `open_hw_target`, `program_hw_devices`); Vivado never enumerates a cable. Typical causes: USB not attached to **this** OS instance (VM / remote dev box), cable driver, JP1 not JTAG, or another process holding the adapter.

**Not a RedByte export defect:** batch synth/impl/bitstream completes; `.bit` path is valid.

## 3. Files changed (example + contract slice)

- `packages/rb-apps/src/apps/ide/examplesCatalog.ts` — `two-bit-counter`: Basys3-first copy; `CLK100MHZ` (clock / `boardResourceType: clock_pin`), `SW0` enable, `BTNC` reset, `LD0`/`LD1` outputs; `timingRole` + tags.
- `packages/rb-apps/src/export/__tests__/golden-examples.test.ts` — pin contract for `two-bit-counter` aligned to catalog.
- IDE landing copy (e.g. `ProjectSurface.tsx`) — row labels match IO story.
- Docs below (this proof + matrix + readiness + RC1 procedure).

## 4. Example / export / verify

| Question | Answer |
|----------|--------|
| Authoritative definition | `examplesCatalog.ts` entry `id: 'two-bit-counter'`. |
| Board clock | `CLK100MHZ` → W5; XDC uses `create_clock -period 10.00` on `CLK100MHZ` in exported `top.xdc`. |
| Verify | Clocked-macro schedule; clock node remains the macro-driven edge for golden sim; IO metadata marks clock as `timingRole: 'clock'`. |
| Expected board behavior | SW0 **high**: counter runs on 100 MHz clock; **LD0** = LSB, **LD1** = MSB (fast LED blur at full speed). **BTNC**: synchronous reset → **00**. SW0 **low**: hold count. |
| Exported artifacts | Open Project: `top.vhd` ports `CLK100MHZ`, `SW`, `BTNC`, `LED(1 downto 0)`; `top.xdc` maps aliases to Basys3 pins. |

## 5. Automated proof

```text
pnpm -w exec vitest run packages/rb-apps/src/export/__tests__/golden-examples.test.ts
pnpm -s ide:gate:export-ready-contract
pnpm -s build:unified
```

(Run before merge; scope can widen if other packages touched.)

## 6. Real Vivado proof (E1)

| Artifact | Path / note |
|----------|-------------|
| Batch log | `out/vivado-cert/vivado_batch_two_bit_counter_e2e.log` |
| Result | `RedByte batch: impl_1 STATUS = write_bitstream Complete!` |
| Bitstream | `out/vivado-cert/examples/two-bit-counter/unpacked/two-bit-counter/two-bit-counter.runs/impl_1/top.bit` |

Export regenerated via `pnpm exec tsx scripts/vivado-cert-export-ide-example.ts two-bit-counter` before the batch run.

## 7. Real board proof (E2 / E3)

### Earlier session (no cable to OS)

| Step | Log | Result |
|------|-----|--------|
| `pnpm lab:vivado:hw-probe` | `out/vivado-cert/hw_probe.log` (2026-04-23 18:43) | **exit 2** — no targets |
| `redbyte_program_device.tcl` | `out/vivado-cert/vivado_program_two_bit_counter_2026-04-23.log` | **exit 2** — no targets |

### Live bench (Basys3 connected)

| Step | Log | Result |
|------|-----|--------|
| `pnpm lab:vivado:hw-probe` | `out/vivado-cert/hw_probe.log` (2026-04-23 **19:07**) | **exit 0** — `targets on localhost:3121 = 1` |
| `redbyte_program_device.tcl` | `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log` (2026-04-23 **19:09**) | **exit 0** — `RedByte program: SUCCESS` |
| JTAG target (Vivado) | (see program log) | `Opening hw_target localhost:3121/xilinx_tcf/Digilent/210183BF7C42A` |
| Device | | `xc7a35t_0` |
| Bitstream | | `out/vivado-cert/examples/two-bit-counter/unpacked/two-bit-counter/two-bit-counter.runs/impl_1/top.bit` |

**E3 (behavior):** Run the TA checklist in `docs/RC1_STUDENT_RELEASE_FREEZE.md` §3 item **3** (SW0 enable, BTNC reset, LD0/LD1 at 100 MHz). Record a dated observation in the certification matrix when signed off; agent sessions cannot substitute for eyes on the LEDs.

## 8. Nearby examples that may share old IO assumptions

- File-backed starters under `packages/rb-apps/src/examples/*.json` and `labStarters.ts` entries not yet matrix-row certified.
- `22_lab7-sync-counter-starter-basys3.json` — scaffold; confirm W5 + alias policy before advertising.
- Lab 8 / FSM rows — higher stack; certify after this counter row reaches E2/E3 on a lab PC.

## 9. Exact certification claim for `two-bit-counter`

| Tier | Status (2026-04-23) |
|------|---------------------|
| **L0** | yes (IDE + Verify + map) |
| **E0** | yes (gates + golden pin contract) |
| **E1** | **yes** — `vivado_batch_two_bit_counter_e2e.log` + `impl_1/top.bit` |
| **E2** | **yes** on live bench — `vivado_program_two_bit_counter_e2_2026-04-23.log` |
| **E3** | **pending TA sign-off** — use RC1 freeze §3; update matrix when observation is recorded |

**Student-safe wording:** “Sequential example: **E1 + E2** proven on a connected Basys3; **E3** after instructor confirms LED/switch behavior matches Verify.”
