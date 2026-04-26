---
type: architecture
status: active
area: infrastructure
updated: 2026-04-26
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Basys 3 Mapping]]"
---

# Support Matrix — Student Project Complexity Classes

Quick reference for what is safe to assign, what is fenced, and what needs bench proof.  
Full detail + evidence logs: `docs/STUDENT_RELEASE_READINESS.md` · `docs/RC1_STUDENT_RELEASE_FREEZE.md`  
Certification matrix with dated logs: `docs/release/vivado-basys3-certification-matrix.md`

---

## Certification tiers (must not be conflated)

| Tier | Shorthand | Meaning |
|------|-----------|---------|
| **L0** | RedByte-valid | Design/Verify/Hardware/Export workflow behaves; project loads/saves |
| **E0** | Export-valid | ZIP is internally consistent (top.vhd, top.xdc, .xpr, Tcl, manifest). Proven by repo tests — **not** Vivado. |
| **E1** | Vivado-build-certified | Real Vivado `synth_1 → impl_1 → write_bitstream` completes (batch log) |
| **E2** | Board-program-certified | `.bit` programs via Hardware Manager or `redbyte_program_device.tcl` |
| **E3** | Behavior-certified | Documented observation matches agreed procedure (switches/LEDs/clock) |

**Minimum for hardware lab:** E1 + E2 + E3 for the specific project class assigned.

---

## Complexity class support status

| Class | Example | L0 | E0 | E1 | E2 | E3 | Safe to assign? |
|-------|---------|----|----|----|----|----|----|
| **Blank combinational** | `fs-comb-switch-and-basys3` | ✓ | ✓ | ✓ | ✓ | pending | E1+E2 ✓ — run E3 checklist |
| **Blank sequential** | `fs-seq-two-bit-counter-basys3` | ✓ | ✓ | ✓ | ✓ | pending | E1+E2 ✓ — run E3 checklist |
| **Gallery: switch-and** | `golden-basys3-switch-and` | ✓ | ✓ | ✓ | pending | pending | E1 only — needs bench session |
| **Gallery: signal-tour** | `signal-tour` | ✓ | ✓ | ✓ | pending | pending | E1 only — needs bench session |
| **Gallery: two-bit-counter** | `two-bit-counter` (CLK100MHZ→W5) | ✓ | ✓ | ✓ | ✓ | pending | E1+E2 ✓ — run E3 checklist |
| **Imported multi-file** | security-lock round-trip | ✓ | ✓ | partial | — | — | Fenced — see release docs |
| **SSD-heavy / Lab 8** | FSM lock | ✓ | partial | — | — | — | Fenced — not RC1 turnkey |
| **Final-project class** | Complex hierarchy + bus | ✓ | partial | — | — | — | Not certified — arbitrary complexity |

---

## Lab-day supported logic subset

Classes and features that are lab-day safe (full detail: `docs/lab-day-vivado-basys3-readiness.md`):

- Basic gates: AND2, OR2, NOT, NAND2, NOR2, XOR2, XNOR2
- Sequential: DFlipFlop, DLatch, TFlipFlop, JKFlipFlop
- Counters: Up-counter with synchronous reset (CLK100MHZ→W5)
- I/O: SW0–SW15, LD0–LD15, BTN (BTNC/BTNU/BTND/BTNL/BTNR), CLK100MHZ
- Verified with `CLOCK_BUFFER_TYPE NONE` on switch inputs

**Fenced (not lab-day promise):** 7-segment display, SPI/I2C, hierarchical chips with bus-native types, FSM lock, Lab 8 full complexity.

---

## E3 procedures (TA observation checklist)

| Row | E3 check |
|-----|----------|
| `golden-basys3-switch-and` | LD0 lights **only** when SW0 **and** SW1 are both high |
| `signal-tour` | SW0→LD0, SW1→LD1, SW2→LD2, SW3→LD3 individually |
| `two-bit-counter` | SW0 high = counter runs at 100 MHz (LD0=LSB, LD1=MSB). SW0 low = hold. BTNC = sync reset to 00. |

---

## Reproduce certification

```powershell
# Any IDE example
pnpm exec tsx scripts/vivado-cert-export-ide-example.ts <id>
# Then point batch Tcl at the printed .xpr

# Program device
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts\vivado\redbyte_program_device.tcl -tclargs <bit-path>
```

Full commands: `scripts/vivado/README.md`
