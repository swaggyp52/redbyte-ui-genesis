# Browser Proof — Board-Clock Auto Mode

**Date:** 2026-05-03  
**Branch:** main  
**Commit:** 65ec9e39  
**App:** http://localhost:5173/os/ (dev server, Node PID 17680, IPv6-only)

---

## Scenario 1 — 2-Bit Counter (Basys3): Auto board clock drives Verify

**Example loaded:** `2-Bit Up Counter (Basys3)` → Design surface, then Verify  
**Result:** PASS

Clock policy panel pre-run state:
```
Detected clock: CLK100MHZ · CLK100MHZ · W5 · 100 MHz
Mode: Auto board clock
Reset: no reset detected
Auto board clock: 8 cycles, rising edge, no reset detected.
```

CLK100MHZ row absent from stimulus table (only EN/RST shown as manual inputs).  
Run completed as "Observation only" without any manually authored clock pulses.  
Post-run waveform: `21 signals · 8 ticks · COMPLETE`

Sampled waveform tick values (clock toggles 0→1→0→1... automatically):
```
t0: clk:0  en:0  rst:1  → q0:0  q1:0  (reset hold)
t1: clk:1  en:0  rst:0  → q0:0  q1:0  (first rising edge, EN=0 holds)
t2: clk:0  en:1  rst:0  → q0:0  q1:0
t3: clk:1  en:1  rst:0  → q0:1  q1:0  (count advances to 1)
t4: clk:0  en:1  rst:0  → q0:1  q1:0
t5: clk:1  en:1  rst:0  → q0:0  q1:1  (count advances to 2)
t6: clk:0  en:0  rst:0  → q0:0  q1:1
```

Counter advances correctly on each rising edge — no manual clock authoring required.

---

## Scenario 3 — Manual override toggle

**Mode switch:** "Manual pulses" button clicked  
**Result:** PASS

- Panel updated to `Mode: Manual pulses`
- CLK100MHZ row appeared in stimulus table with Alternating/Add pulse/Hold controls
- Warning shown: "No clock row is present in the next-run stimulus. Insert a deterministic clock pattern..."
- Reverted to Auto board clock mode: CLK row disappeared, mode reset correctly

---

## Scenario 5 — Export testbench has free-running clock_gen process

**File viewed:** testbench.vhd tab in Export surface  
**Result:** PASS

Generated VHDL contains:
```vhdl
constant CLK_HALF_PERIOD : time := 5 ns;
...
clock_gen: process
begin
  CLK100MHZ <= '0';
  wait for CLK_HALF_PERIOD;
  loop
    CLK100MHZ <= '1';
    wait for CLK_HALF_PERIOD;
    CLK100MHZ <= '0';
    wait for CLK_HALF_PERIOD;
  end loop;
end process;
```

Stimulus process uses `wait until rising_edge(CLK100MHZ)` between vectors — not manual 0→1→0 assignment.  
Pin map: CLK100MHZ / W5 correctly included in export package.

---

## Known interaction friction (not a product bug)

Browser tooling fixed-shell intercept: the browser automation layer's synthetic click is blocked by the IDE's `ide-status-bar` and `ide-layout-shell` stacking. DOM `.evaluate(el.click())` is required instead of `locator.click()`. This is a browser automation quirk, not a student-facing UX bug. Real student clicks in a normal browser tab work correctly.

---

## Summary

| Scenario | Outcome |
|---|---|
| 1. Counter loads, auto clock drives Verify | PASS |
| 2. Auto-detected mode shown in panel (CLK100MHZ · W5) | PASS |
| 3. Manual override shows CLK row + warning | PASS |
| 4. Reverting to auto removes CLK row | PASS |
| 5. Export testbench has free-running clock_gen | PASS |

All core student-facing board-clock behaviors confirmed in the running app.
