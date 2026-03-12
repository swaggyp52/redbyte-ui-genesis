# Manual Release Proof Steps (Vivado + Basys3)

Date: 2026-03-11
Prepared artifacts directory:
- C:/Users/conno/redbyte-ui/artifacts/manual-release-proof/2026-03-11

Bundles:
1. manual-proof-pass-through.zip
2. manual-proof-sequential-clk100mhz.zip

Checksums are in release-proof-summary.json.

---

## A) Pass-through proof (SW0 -> LD0)

1. Unzip manual-proof-pass-through.zip.
2. In Vivado, Open Project and select:
   - manual-proof-pass-through/manual-proof-pass-through.xpr
3. Confirm top module is top.
4. Run Synthesis.
5. Run Implementation.
6. Generate Bitstream.
7. Open Hardware Manager and program Basys3.
8. Physical behavior check:
   - SW0 OFF => LD0 OFF
   - SW0 ON => LD0 ON

Required evidence to capture:
- Vivado screenshot after synthesis success.
- Vivado screenshot after implementation success.
- Vivado screenshot after bitstream generation success.
- Photo/video of Basys3 showing SW0 toggles LD0.

---

## B) Sequential proof (CLK100MHZ design)

1. Unzip manual-proof-sequential-clk100mhz.zip.
2. In Vivado, Open Project and select:
   - manual-proof-sequential-clk100mhz/manual-proof-sequential-clk100mhz.xpr
3. Confirm top module is top.
4. Run Synthesis.
5. Run Implementation.
6. Generate Bitstream.
7. Open Hardware Manager and program Basys3.
8. Physical behavior check:
   - SW0 is reset (rst).
   - SW1 is enable (count_en).
   - With SW1=1 and SW0=0, LD0..LD3 count on CLK100MHZ.
   - With SW0=1, LD0..LD3 reset to 0000.

Required evidence to capture:
- Vivado screenshot after synthesis success.
- Vivado screenshot after implementation success.
- Vivado screenshot after bitstream generation success.
- Photo/video of Basys3 showing reset and counting behavior on LD0..LD3.

---

## Failure capture template (use this exactly)

For each failure, capture:
- Stage: synthesis | implementation | bitstream | programming | physical behavior
- Exact Vivado error text (copy full message)
- Artifact file and line number (if given)
- Root cause class:
  - top identity drift
  - naming drift between HDL/XDC/testbench
  - unresolved identifier in HDL
  - constraints issue
  - Vivado project reference mismatch
  - hardware/programming issue
- Smallest truthful fix applied
- Re-run result after fix

Suggested issue block:

- Stage:
- Error text:
- File and line:
- Root cause:
- Fix:
- Re-test outcome:

---

## Notes

- This environment cannot run Vivado or access Basys3 hardware directly.
- The exported bundles were generated from current RedByte code and passed local contract tests before handoff.
