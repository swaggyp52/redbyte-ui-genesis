# ECE141 Lab 6 — Sequential Logic: Latches and Flip-Flops
## Basys3 + Vivado + RedByte Edition

**Course:** ECE141 Digital Logic Design Lab — Gannon University
**Tools required:** RedByte (browser), Vivado 2025.1, Basys3 FPGA Board, USB-A to micro-USB cable

---

## Objective

Design and verify four sequential storage elements on a single schematic: a D latch, a
D flip-flop, a T flip-flop, and a JK flip-flop. Wire each element's inputs to slide
switches and its Q output to an LED. Run verification vectors that exercise each
element's characteristic table. Export the design to VHDL and program a Basys3 FPGA.

---

## Background

### Combinational vs. Sequential Logic

Combinational circuits (Labs 1–5) have outputs that depend only on the current inputs.
Sequential circuits have **memory**: outputs depend on current inputs AND on prior
history stored in flip-flops or latches.

A **latch** is **level-sensitive**: its output follows the data input while the enable
(EN) signal is HIGH. When EN goes LOW, the latch holds its last value.

A **flip-flop** is **edge-triggered**: its output changes only on a clock edge (typically
rising, LOW→HIGH). The data input is sampled instantaneously at that edge and held.

### Elements in This Lab

| Element | Type | Clock input | Characteristic behavior |
|---|---|---|---|
| D Latch | Level-sensitive | EN (active HIGH) | Q = D while EN=1; holds Q when EN=0 |
| D Flip-Flop | Edge-triggered | CLK (rising edge) | Q captures D on rising CLK |
| T Flip-Flop | Edge-triggered | CLK (rising edge) | Q toggles on rising CLK if T=1; holds if T=0 |
| JK Flip-Flop | Level-sensitive | CLK (active HIGH) | Set/Reset/Toggle/Hold based on J, K while CLK=1 |

### Characteristic Tables

**D Latch:**

| EN | D | Q_next |
|---|---|---|
| 0 | X | Q (hold) |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

**D Flip-Flop (rising-edge triggered):**

| CLK edge | D | Q_next |
|---|---|---|
| rising | 0 | 0 |
| rising | 1 | 1 |
| non-rising | X | Q (hold) |

**T Flip-Flop (rising-edge triggered):**

| CLK edge | T | Q_next |
|---|---|---|
| rising | 0 | Q (hold) |
| rising | 1 | NOT Q (toggle) |
| non-rising | X | Q (hold) |

**JK Flip-Flop (CLK=1 enables inputs):**

| CLK | J | K | Q_next |
|---|---|---|---|
| 0 | X | X | Q (hold) |
| 1 | 0 | 0 | Q (hold) |
| 1 | 0 | 1 | 0 (reset) |
| 1 | 1 | 0 | 1 (set) |
| 1 | 1 | 1 | NOT Q (toggle) |

### RedByte Simulation Note

The D Latch and D Flip-Flop in RedByte use level-sensitive simulation internally to
avoid feedback oscillation in the tick model. The **exported VHDL is correct and
synthesizes as edge-triggered** on the FPGA. The simulation accurately demonstrates
the HOLD behavior; for edge-triggering, observe the Q output changing when CLK
transitions LOW→HIGH.

---

## Basys3 Pin Assignments

| Signal | Role | Basys3 Pin | Physical Location |
|---|---|---|---|
| D | Data input (DLatch + DFF) | V17 | Slide switch SW0 |
| EN | Enable (DLatch) | V16 | Slide switch SW1 |
| CLK | Clock (DFF + TFF + JK) | W16 | Slide switch SW2 |
| T | Toggle (TFF) | W17 | Slide switch SW3 |
| J | J input (JKFF) | W15 | Slide switch SW4 |
| K | K input (JKFF) | V15 | Slide switch SW5 |
| Q_DL | D Latch output | U16 | LED LD0 |
| Q_DFF | D Flip-Flop output | E19 | LED LD1 |
| Q_TFF | T Flip-Flop output | U19 | LED LD2 |
| Q_JK | JK Flip-Flop output | V19 | LED LD3 |

---

## Pre-Lab (Complete Before Coming to Lab)

### Step P1 — Complete the Characteristic Tables

For each element, fill in the "Q_next" column for each input combination. Use the
background tables above as a guide.

**D Latch — fill in Q_next:**

| EN | D | Q_next |
|---|---|---|
| 0 | 0 | |
| 0 | 1 | |
| 1 | 0 | |
| 1 | 1 | |

**T Flip-Flop — fill in Q_next (assume Q=0 initially):**

| CLK rising edge? | T | Q (before) | Q_next |
|---|---|---|---|
| No | 1 | 0 | |
| Yes | 0 | 0 | |
| Yes | 1 | 0 | |
| Yes | 1 | 1 | |

**JK Flip-Flop — fill in Q_next:**

| CLK | J | K | Q_next |
|---|---|---|---|
| 1 | 0 | 0 | |
| 1 | 1 | 0 | |
| 1 | 0 | 1 | |
| 1 | 1 | 1 | |

### Step P2 — Short Answer

1. What is the key difference between a latch and a flip-flop in terms of clock sensitivity?

2. A T flip-flop with T permanently tied to 1 and CLK toggled at 1 Hz will produce a Q
   output that toggles at what frequency? What application does this enable?

3. In the JK flip-flop, what happens when J=K=1 on the active clock? Why is this condition
   called "toggle" and when would it be useful?

---

## Lab Procedure

### Phase 1 — RedByte Design and Simulation

#### Step 1 — Open Lab 6 Starter

1. Open RedByte in your browser (URL provided by instructor).
2. Click the **Project** surface icon (folder icon on the left rail).
3. In the Example selector, choose **"Lab 6 - Sequential Logic Starter"**.
4. Click **Load** to open the canvas with the four flip-flop elements pre-placed.

You will see four elements already on the canvas (unconnected):
- **DLatch** (D Latch — orange)
- **DFlipFlop** (D Flip-Flop — green)
- **TFlipFlop** (T Flip-Flop — purple)
- **JKFlipFlop** (JK Flip-Flop — yellow)

Six Switch nodes and four Lamp nodes are also pre-placed. Your task is to wire them.

#### Step 2 — Wire the Circuit

Click the **Design** surface icon (pencil icon).

Wire each flip-flop element to its corresponding switch inputs and lamp output.
Red dots on node edges are input ports; green dots are output ports.
Click a green dot and drag to a red dot to create a wire.

**D Latch wiring:**
- `D` switch output → DLatch `D` input
- `EN` switch output → DLatch `EN` input
- DLatch `Q` output → `Q_DL` lamp input

**D Flip-Flop wiring:**
- `D` switch output → DFlipFlop `D` input  *(same D switch as DLatch)*
- `CLK` switch output → DFlipFlop `CLK` input
- DFlipFlop `Q` output → `Q_DFF` lamp input

**T Flip-Flop wiring:**
- `T` switch output → TFlipFlop `T` input
- `CLK` switch output → TFlipFlop `CLK` input  *(same CLK switch as DFF)*
- TFlipFlop `Q` output → `Q_TFF` lamp input

**JK Flip-Flop wiring:**
- `J` switch output → JKFlipFlop `J` input
- `K` switch output → JKFlipFlop `K` input
- `CLK` switch output → JKFlipFlop `CLK` input  *(same CLK switch as DFF, TFF)*
- JKFlipFlop `Q` output → `Q_JK` lamp input

When complete, verify:
- All four lamps are connected
- Each flip-flop has all its inputs driven (no floating inputs)
- The CLK switch drives three elements (DFF, TFF, JKFF)
- The D switch drives two elements (DLatch, DFF)

#### Step 3 — Interactive Simulation

Before running the formal verify, explore the circuit interactively:

1. Click on a Switch node to toggle it. The Lamp nodes update immediately.
2. Observe:
   - With **EN=0**: Toggle D. Does Q_DL change? (It should not — latch holds.)
   - With **EN=1**: Toggle D. Does Q_DL follow D immediately? (It should — transparent.)
   - With **T=1**: Toggle CLK from 0→1. Does Q_TFF change? (It should toggle.)
   - With **T=1**: Toggle CLK from 0→1 again. Does Q_TFF toggle back? (It should.)
   - With **J=1, K=0, CLK=1**: Is Q_JK=1? (SET state.)
   - With **J=0, K=1, CLK=1**: Does Q_JK go to 0? (RESET state.)

#### Step 4 — Enter Test Vectors in the Verify Surface

1. Click the **Verify** surface icon.
2. You will see 6 input columns (D, EN, CLK, T, J, K) and 4 output columns
   (Q_DL, Q_DFF, Q_TFF, Q_JK).
3. Enter the following 14 rows exactly as shown. **Row order matters** — the
   simulation preserves flip-flop state between rows.

| Row | Purpose | D | EN | CLK | T | J | K | Q_DL | Q_DFF | Q_TFF | Q_JK |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Initial state | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | DLatch: EN=1, D=1 → SET | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 3 | DLatch: EN=1, D=0 → RESET | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | DLatch: EN=1, D=1 → SET again | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 5 | DLatch: EN=0 → HOLD Q=1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 6 | DFF: CLK=1, D=1 → capture | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| 7 | DFF: CLK=0 → hold Q=1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 |
| 8 | TFF: set T=1 while CLK=0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 0 |
| 9 | TFF: CLK rising, T=1 → TOGGLE | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| 10 | TFF: CLK low → hold | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| 11 | TFF: CLK rising, T=1 → TOGGLE back | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| 12 | JK: CLK low, reset T=0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| 13 | JK: CLK=1, J=1, K=0 → SET | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 1 |
| 14 | JK: CLK=1, J=0, K=1 → RESET | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |

4. Click **Run Verification**.

Expected result: all 14 rows show **PASS** (green).

**Reading a FAIL:** If row N fails, the table shows expected vs. actual output.
Common causes:
- Wrong switch connected to wrong port (check D vs EN, J vs K)
- Missing wire (floating port defaults to 0)
- Row order changed (do not reorder rows — state depends on sequence)

#### Step 5 — Export Submission ZIP

1. Click **Project** surface → enter your name in "Student name".
2. Confirm the Basys3 (xc7a35tcpg236-1) preset is selected.
3. Click **Export Submission ZIP**.
4. Save the `.zip` (contains `top.vhd`, `top.xdc`, verify evidence).

---

### Phase 2 — Hardware Implementation on Basys3 (If Board Available)

#### Step 6 — Open Vivado 2025.1

1. Launch Vivado 2025.1 from the Start menu (or terminal).
2. Click **Create Project** on the welcome screen.

#### Step 7 — Create a New Vivado Project

1. Project name: `ECE141_Lab6` (no spaces or dashes)
2. Location: your H: drive or Documents folder
3. Project type: **RTL Project**
4. Click Next through source/constraints screens (files added in next step)
5. Default Part screen:
   - Family: **Artix-7**
   - Package: **cpg236**
   - Select: **xc7a35tcpg236-1** (Basys3 FPGA)
6. Click **Finish**.

#### Step 8 — Add Sources from Submission ZIP

1. Unzip your submission ZIP (right-click → Extract All).
2. In Vivado: Flow Navigator → **Add Sources**.
3. **Add Design Sources** → Add Files → select `top.vhd`
4. **Add Constraints** → Add Files → select `top.xdc`
5. Click Finish.

#### Step 9 — Review the Generated VHDL

Before synthesis, open `top.vhd` in Vivado's text editor. Locate the four
process blocks generated by RedByte. Note:

- **D Latch process**: responds to `(EN, D)` — level-sensitive, no clock edge
- **D Flip-Flop process**: uses `rising_edge(CLK)` — edge-triggered
- **T Flip-Flop process**: uses `rising_edge(CLK)` with toggle logic
- **JK Flip-Flop process**: uses `rising_edge(CLK)` with set/reset/toggle/hold

Show this file to your instructor before continuing.

#### Step 10 — Run Synthesis

1. Flow Navigator: click **Run Synthesis**.
2. Wait for completion (1–3 minutes).
3. Check Messages for errors. Timing warnings are ignorable.
4. If synthesis succeeds: click **Run Implementation**.

#### Step 11 — Generate Bitstream and Program Board

1. After implementation completes: click **Generate Bitstream**.
2. When prompted, click **Open Hardware Manager**.
3. Connect the Basys3 board via USB. Click **Open Target** → **Auto Connect**.
4. Click **Program Device** → select the bitstream file → click **Program**.

#### Step 12 — Verify Hardware Behavior

Once programmed, verify each element using the slide switches on the Basys3:

**D Latch (SW0=D, SW1=EN, LD0=Q_DL):**
- Set SW1=1 (EN=1). Toggle SW0 — LD0 should follow SW0 immediately.
- Set SW1=0 (EN=0). Toggle SW0 — LD0 should not change. ✓

**D Flip-Flop (SW0=D, SW2=CLK, LD1=Q_DFF):**
- Set SW0=1 (D=1). Toggle SW2 from 0→1. LD1 should turn on.
- Set SW0=0 (D=0). Toggle SW2 from 0→1. LD1 should turn off.
- Leave SW2=1 and change SW0 — LD1 should not change until next rising edge. ✓

**T Flip-Flop (SW3=T, SW2=CLK, LD2=Q_TFF):**
- Set SW3=1 (T=1). Toggle SW2 from 0→1 — LD2 toggles.
- Toggle SW2 again (0→1) — LD2 toggles back.
- Set SW3=0 (T=0). Toggle SW2 — LD2 should not change. ✓

**JK Flip-Flop (SW4=J, SW5=K, SW2=CLK, LD3=Q_JK):**
- Set SW2=1. Set SW4=1, SW5=0. LD3 should be 1 (SET).
- Set SW4=0, SW5=1. LD3 should become 0 (RESET).
- Set SW4=0, SW5=0. Toggle SW2. LD3 holds at 0. ✓

---

## What to Include in Your Lab Report

1. **Pre-lab tables**: completed characteristic tables for DLatch, TFF, JKFF.
2. **Pre-lab question answers** (P2, questions 1–3).
3. **Screenshot of Verify surface**: all 14 rows showing PASS.
4. **Annotated circuit diagram**: sketch of the RedByte canvas showing the four
   elements, their input switches, and their output lamps.
5. **Observations from hardware** (Phase 2): describe what you observed for each
   element on the Basys3. Did all four behave as expected? If not, describe any
   discrepancy.
6. **Discussion question**: The JK flip-flop in RedByte simulation is level-triggered
   (responds when CLK=1), but the exported VHDL uses `rising_edge(CLK)`.
   What is the practical difference on hardware? Why does edge-triggering matter
   in a real digital system?

---

## Grading Checklist

- [ ] Pre-lab characteristic tables completed for all three elements (DLatch, TFF, JKFF)
- [ ] Pre-lab questions answered
- [ ] RedByte circuit correctly wired (all 4 elements, 6 switches, 4 lamps)
- [ ] Verify surface shows PASS on all 14 rows
- [ ] Submission ZIP exported
- [ ] (Phase 2) VHDL `top.vhd` reviewed and shown to instructor
- [ ] (Phase 2) Bitstream programmed and all four elements verified on hardware
- [ ] Lab report includes screenshot, annotated diagram, and discussion question

---

## Troubleshooting

**"Q_DL never changes even with EN=1."**
Verify the EN switch is wired to the DLatch's `EN` port (not the CLK port).
The DLatch has two ports: D and EN. Check color coding: the DLatch node is orange.

**"Q_TFF never toggles."**
For TFlipFlop, toggling means raising CLK from low to HIGH. If CLK starts HIGH,
no rising edge occurs. First set the CLK switch to 0, then to 1 — that creates
the rising edge that triggers the toggle.

**"Row 9 fails — Q_TFF shows 0 instead of 1."**
Make sure rows are entered in the exact order shown. Row 9 depends on row 8
having set T=1 while CLK=0. If you reordered or skipped rows, the flip-flop
state will be different.

**"Q_JK goes to 1 unexpectedly in rows 6–11."**
Check that J and K switches are both set to 0 in those rows. If J=1 with CLK=1,
the JK flip-flop will SET. Confirm the J switch output goes to the `J` port, not
the `CLK` port.

**"Synthesis completes but with errors."**
Open `top.vhd` and look for syntax issues. If multiple processes drive the same
signal (unusual with RedByte-generated VHDL), check that you only have one
output lamp per flip-flop Q output.

**"Basys3 LD2 (Q_TFF) doesn't toggle when I flip SW2."**
The T flip-flop is edge-triggered in hardware. You must physically flip the slide
switch from the 0 position to the 1 position (LOW→HIGH transition). Flipping from
1→0 is a FALLING edge and does not affect Q.
