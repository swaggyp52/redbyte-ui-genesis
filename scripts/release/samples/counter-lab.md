# Enabled modulo-8 counter lab

Open `enabled-modulo-8-counter.rb-session.json` through File → Open Existing Project
→ Open .rbproj File. This complete session was authored through the workbench's
visible controls. It includes the repaired design, three authored scenarios, earlier
failures and passing recordings, a Basys3 mapping, and an export receipt. Imported
recordings describe their captured circuit; rerun to obtain evidence for your edits.

The design has three scalar Register1 registers sharing CLK, each with active-high
asynchronous clear RST. The reusable IncrementSlice computes `NEXT = BIT xor CARRY`
and `CARRY_OUT = BIT and CARRY`. EN supplies the low slice's carry; each carry output
feeds the next slice. COUNT2..COUNT0 show the three stored bits. With RST asserted,
count is zero immediately. With EN high, each rising CLK edge advances the count
modulo eight; otherwise it holds. EN and data must settle before the active edge.

The independent oracle was specified before inspecting simulation results. The
acceptance script is `packages/rb-e2e/student-counter-session.mjs` in the source
checkout. It creates the entire lab from Blank project using placement, port clicks,
module creation, the event editor, and file menus. Runtime reads assert identity and
content; they never author state. The sample is its downloaded backup.

| Scenario | Events | Output checks | Behavior |
| --- | ---: | ---: | --- |
| Count and wrap | 18 | 54 | Reset, count 0 through 7, wrap to 0 |
| Enable hold and asynchronous reset | 10 | 30 | Pause counting; clear while CLK stays high; resume |
| Pause and resume without a clock edge | 11 | 33 | EN changes while CLK stays high hold state; reset and count again |

For a 10-minute owner review:

1. In Design, Fit the circuit and inspect the three IncrementSlice instances. Enter
   one instance to inspect its XOR/AND definition and return using the breadcrumb.
   Select a register: its optional enable pin is disabled; RST is async clear.
2. In Simulate select Count and wrap and Run. Inspect t14..t17: seven is followed by
   zero at the next rising edge. Select the earlier failing recording. It describes
   the original wrong high-bit carry connection and must remain historical.
3. In Enable hold and asynchronous reset select t5. RST is high while CLK remains
   high; all expected bits are zero. Change COUNT0's expectation to one, Run, inspect
   the mismatch and driver, restore zero and rerun. Count and wrap must be unchanged.
4. In the pause/resume scenario inspect t1 and t2. EN is asserted while CLK is low at
   t1, before t2's rising edge. An earlier recording asserted EN and CLK together;
   moving EN to t1 repaired the stimulus without changing expected output checks.
5. Save, close the app tab, Stop, then Start at the same address in the same browser.
   Your project and recorded history should return. Open a second blank project,
   then return to this one. Try Save As; the original must remain unchanged.
6. In Board inspect CLK→CLK100MHZ, EN→SW0, RST→BTNC and COUNT0/1/2→LD0/1/2.
   The captured constraint set is named Basys3 counter controls.
7. In Package inspect HDL, testbench and XDC, then download the ZIP. Check pins
   W5, V17, U18, U16, E19 and U19 respectively. The receipt identifies requested ZIP
   bytes; it does not certify Vivado synthesis, a bitstream or a programmed board.
8. File → Export Project Backup. Open that backup in another browser profile or port,
   rerun Count and wrap, and inspect/export its artifacts. Keep the backup outside
   the extracted application folder. The application ZIP contains this sample,
   but does not automatically contain your later browser work.

Acceptance remains local Browser E0. Owner judgment, Vivado 2024.2 synthesis and
physical Basys3 observation are separate release decisions.
