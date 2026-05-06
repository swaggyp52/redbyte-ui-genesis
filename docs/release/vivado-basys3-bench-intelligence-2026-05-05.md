# Vivado + Basys3 Bench Intelligence - 2026-05-05

**Purpose:** Use real Vivado and a real Basys3 target as feedback for RedByte's professional FPGA handoff, not merely as an example-upload smoke test.

## Environment

| Item | Result |
|---|---|
| OS | Windows 11 Education, 10.0.26100, 64-bit |
| Vivado | 2024.2, SW build 5239630 |
| Vivado path | `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` |
| `XILINX_VIVADO` | not set |
| `hw_server` | present at `C:\Xilinx\Vivado\2024.2\bin\hw_server.bat` |
| `djtgcfg` | not on PATH |
| USB visibility | FTDI/Digilent-style USB composite device visible, VID `0403`, PID `6010`, serial `210183BF7C42`, COM8 |
| Vivado hardware target | `localhost:3121/xilinx_tcf/Digilent/210183BF7C42A` |
| FPGA device | `xc7a35t_0`, part `xc7a35t`, IDCODE `00000011011000101101000010010011` |

Commands used included `pnpm rb:work:status`, `pnpm rb:control:next`, `pnpm rb:control:trace-claims`, `pnpm lab:vivado:hw-probe`, `vivado -version`, `where.exe vivado`, `where.exe hw_server`, `where.exe djtgcfg`, Vivado batch build Tcl, and Vivado batch programming Tcl. Raw logs and generated summaries were written under gitignored `.redbyte/agent/runs/bench/`.

Known tooling limits from this machine:

- `pnpm rb:agent:ollama:doctor` and `pnpm rb:memory:doctor` failed because Ollama CLI/API was unavailable.
- `pnpm rb:memory:synth` / `rb:memory:trace` were also blocked because the memory index was missing.
- The deterministic problem intake loop still worked, using fallback mode.

## Bench Matrix

| Target | Export | Synthesis | Implementation | Bitstream | Program | Board Observed | Warnings | RedByte Gap |
|---|---|---|---|---|---|---|---|---|
| `golden-basys3-switch-and` | yes | success | success | success | success | manual required | path length, no clock/timing warnings | Classify combinational no-clock timing/power warnings |
| IDE `signal-tour` | yes | success | success | success | success | manual required | path length, optimized empty-top, no clock/timing warnings | Explain pass-through optimization warnings after Vivado |
| IDE `half-adder` | yes | success | success | success | success | manual required | path length, first-run generated-run warnings, no clock/timing warnings | Explain benign project-run and combinational timing warnings |
| IDE `two-bit-counter` | yes | success | success | success | success | manual required | path length, parallel synthesis note | Add target-specific board observation checklist for fast clock/LED semantics |

All four bitstreams programmed through `scripts/vivado/redbyte_program_device.tcl` on the detected Basys3 target. This is current E2 evidence for the bench run. It is not E3 behavior proof because no visual/manual observation was recorded in this session.

## Warning Taxonomy

| Category | Example from this bench | Product implication |
|---|---|---|
| Environment/setup | Vivado warns that the project path is long on Windows. | RedByte should recommend short extraction paths or `subst` for lab machines before users hit path-sensitive Vivado behavior. |
| Export/project generation | First-run `.xpr` state can report missing `GeneratedRun` files and disabled auto-incremental compile. | These are not export failures; RedByte should collect and label them as benign first-run Vivado project messages. |
| XDC/constraint handling | Implementation-specific XDC constraints are ignored for synthesis and used in implementation. | RedByte should explain this as a normal constraint-use split when `CLOCK_BUFFER_TYPE NONE` appears on switch/button inputs. |
| HDL/synthesis | `signal-tour` produced `design top has an empty top module`. | Pass-through IO can optimize into IBUF/OBUF only; success with this warning needs product explanation. |
| Implementation/timing | Combinational designs report no user timing constraints and no user-defined clocks for power estimation. | RedByte should distinguish acceptable combinational no-clock warnings from missing sequential clock constraints. |
| Sequential timing | `two-bit-counter` used the W5 clock path and completed with positive timing slack. | The board-clock path is stronger than the combinational rows because Vivado has real timing constraints. |

## Product Gaps Discovered

1. RedByte needs a Vivado-warning classifier that separates build blockers from benign/confusing warnings.
2. RedByte should preserve raw Vivado logs and produce a compact matrix by target.
3. Export handoff docs should mention Windows path-length risk for long extracted project paths.
4. Signal-pass-through examples need an explanation for optimized-empty-top warnings.
5. Combinational examples need no-clock timing/power warning language that does not scare users or hide the warning.
6. Board programming reports need to stay separate from board-observation reports.
7. E3 checklists should be target-specific: switches/buttons toggled, LEDs observed, expected behavior, evidence type, and uncertainty.

## What RedByte Should Automate Next

- Parse Vivado logs into `success`, `success with warnings`, `fail`, `program success`, and `board observation required`.
- Generate per-target board-observation templates next to the build/program logs.
- Preflight environment facts: Vivado path, version, `hw_server`, cable visibility, `XILINX_VIVADO`, and Windows path-length risk.
- Add explanatory copy for known warning classes in the exported README or bench report.

## What RedByte Should Not Automate Yet

- Do not claim E3 from `program_hw_devices` success.
- Do not mark LED/switch behavior as passed without human observation, photo/video evidence, or an instrumented readback path.
- Do not hide Vivado warnings simply because `write_bitstream` completed.
- Do not broaden Lab 8 / seven-seg / hierarchical-bus claims from these four rows.

## Repo Change From This Sprint

Added `scripts/rb-vivado-bench.mjs` and package aliases:

- `pnpm rb:bench:doctor`
- `pnpm rb:bench:vivado`
- `pnpm rb:bench:summarize`
- `pnpm rb:bench:classify`
- `pnpm rb:bench:evidence-pack`

The helper wraps existing RedByte export/build/program evidence. It writes generated reports under `.redbyte/agent/runs/bench/`, including the required matrix, warning taxonomy, environment report, JSON summary, and per-target board-observation templates.

## Proof Closure Judgment

This bench run can advance current E1/E2 confidence for the specific rows above. It cannot honestly close proof closure because `golden-basys3-switch-and`, `half-adder`, and `two-bit-counter` still need E3 behavior observation, and `signal-tour` already had prior E3 evidence but was not newly observed in this run.

Attribution: Connor Angiel
