# Vivado Export Fidelity + Board Rehearsal Proof

Date: 2026-04-23
Owner: Connor Angiel
Slice: Vivado export fidelity + board rehearsal reset

## Manual artifact rehearsal

Command run:

```powershell
pnpm tsx scripts/lab8-vivado-export.ts
```

Result:

- `bundle.valid = true`
- `top.vhd length: 3244 chars`
- `top.xdc length: 1671 chars`
- `vivado_import.tcl length: 1265 chars`
- `testbench.vhd length: 10699 chars`
- deterministic ZIP SHA256:
  - `5000809bda02132c906404171ca66f57fc0c2af514743e453ba514e709704457`

Generated local artifacts:

- `out/lab8/top.vhd`
- `out/lab8/top.xdc`
- `out/lab8/vivado_import.tcl`
- `out/lab8/testbench.vhd`
- `out/lab8/README.md`
- `out/lab8/lab8_security_lock.rb-lab.zip`
- `out/lab8/run-log.txt`

## Board / clock truth observed

The rehearsal artifact preserved the expected Lab 8 Basys3 bindings:

```text
set_property PACKAGE_PIN V15 [get_ports {SW[5]}]
set_property PACKAGE_PIN W14 [get_ports {SW[6]}]
set_property PACKAGE_PIN W13 [get_ports {SW[7]}]
set_property PACKAGE_PIN V2 [get_ports {SW[8]}]
set_property PACKAGE_PIN W15 [get_ports {SW[4]}]
set_property PACKAGE_PIN E19 [get_ports {LED1}]
```

The exported VHDL head was:

```vhdl
entity top is
  Port (
    SW : in  STD_LOGIC_VECTOR(8 downto 4);
    LED1 : out STD_LOGIC
  );
end entity top;
```

This Lab 8 design intentionally uses a manual switch as the event source, so the rehearsal confirms:

- no false `create_clock` was emitted for the manual switch clock path
- the manual-clock timing policy remained explicit in `top.xdc`

## Project-folder fidelity proof

Project-folder export fidelity for canonical `top.xdc` was validated by tests in this slice:

- `packages/rb-apps/src/__tests__/ide-vivado-project-folder-contract.test.ts`
- `packages/rb-apps/src/__tests__/ide-vivado-artifact-consistency.test.ts`

Those checks now prove:

- `.xpr` references `constrs_1/new/top.xdc`
- `vivado_import.tcl` references `constrs_1/new/top.xdc`
- sequential project-folder bundles preserve `PACKAGE_PIN W5` and `create_clock -period 10.000`

## Limitation note

No actual Vivado synth / impl / bitstream run was executed in this repo environment during this slice. The proof here is handoff-artifact proof plus the widened deterministic test matrix, not a full toolchain compile transcript.
