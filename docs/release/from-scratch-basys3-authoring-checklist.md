# From-scratch Basys3 authoring checklist (TA / instructor)

Use this to validate **blank-project** student workflow end-to-end—not loading a gallery example.

**Prereqs:** Vivado 2024.2, Basys3, USB-JTAG visible (`pnpm lab:vivado:hw-probe` exit **0**).

---

## A. Combinational (e.g. SW0 ∧ SW1 → LD0)

1. **Project:** Open IDE → start **blank** design (empty canvas).
2. **Design:** Place INPUT nodes (labels `SW0`, `SW1`), gates, OUTPUT (`LD0`); wire **SW0 ∧ SW1** to `LD0`.
3. **Verify:** Add vectors for all input combinations; run Compare; fix until green.
4. **Map Pins:** Map to Basys3 **aliases** `SW0`, `SW1`, `LD0` (avoid raw `V17` unless you know the mapping).
5. **Export:** Basys3 → **Vivado Project (Open Project)** ZIP; confirm bundle valid.
6. **Vivado:** `redbyte_batch_synth_impl_bitstream.tcl` on the `.xpr` → `write_bitstream Complete!`
7. **Program:** `redbyte_program_device.tcl` with `impl_1/top.bit`
8. **Observe (E3):** LD0 is **on** only when **both** SW0 and SW1 are **on**.

**Automation twin:** Fixture `fs-comb-switch-and-basys3` — `pnpm lab:vivado:cert:from-scratch fs-comb-switch-and-basys3`

---

## B. Sequential (2-bit up counter, board clock)

1. **Project:** Blank canvas; build small clocked counter (DFFs + XOR/AND reset gating) or equivalent lab-approved topology.
2. **Clock:** Top-level INPUT labeled **`CLK100MHZ`** (board oscillator intent); **not** a switch-as-clock for this cert path.
3. **Controls:** Map **enable** to `SW0`, **sync reset** to `BTNC`, outputs to `LD0`/`LD1` (or your agreed labels).
4. **Verify:** Clocked-macro / Compare schedule consistent with IDE guidance; vectors pass.
5. **Map Pins:** `CLK100MHZ`, `SW0`, `BTNC`, `LD0`, `LD1` (aliases).
6. **Export / Vivado / Program:** Same as A.
7. **Observe (E3):** With enable high, LEDs reflect fast 100 MHz counting (often **blurred**); **BTNC** resets to **00**; enable low **holds**—match your Verify narrative.

**Automation twin:** Fixture `fs-seq-two-bit-counter-basys3` — `pnpm lab:vivado:cert:from-scratch fs-seq-two-bit-counter-basys3`

---

## C. What this checklist does *not* promise

- Lab 8 FSM + seven-segment stacks without separate certification.
- Designs using **unsupported** XDC timing directives (see export errors for generated clocks).
- VHDL-import-only flows without passing the IDE export contract.

---

## D. Evidence to archive after a class rehearsal

- `vivado_batch_*.log` with `BITSTREAM =`
- `vivado_program_*.log` with `RedByte program: SUCCESS`
- Short **E3** note (date, board id, observer) in the certification matrix or proof doc
