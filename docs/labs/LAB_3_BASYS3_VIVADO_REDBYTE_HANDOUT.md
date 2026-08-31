# ECE141 Lab 3 — Seven-Segment Display Driver
## Basys3 + Vivado + RedByte Edition

**Course:** ECE141 Digital Logic Design Lab — Gannon University
**Tools required:** RedByte (browser), Vivado 2025.1, Basys3 FPGA Board, USB-A to micro-USB cable

---

## Objective

Design a seven-segment display (SSD) driver that converts a 4-bit binary number (0-9)
into the cathode control signals for a common-anode seven-segment display. Verify the
design with simulation in RedByte, then synthesize and program a Basys3 FPGA board
using Vivado 2025.1.

---

## Background

### Seven-Segment Display

A seven-segment display has 7 LEDs labeled a through g. By lighting different combinations,
the digits 0-9 can be displayed. The Basys3 board uses a **common-anode** display: the anode
(+) of all 7 segments is tied together and driven high, while each cathode is driven
**low (logic 0) to turn the segment ON**.

```
     a
    ---
f  |   |  b
   | g |
    ---
e  |   |  c
   |   |
    ---
     d
```

Segment pattern for digit "3": segments a, b, c, d, g ON → cathodes CA=0, CB=0, CC=0, CD=0, CE=1, CF=1, CG=0.

### Design Specification

- Inputs: B3, B2, B1, B0 (4-bit binary, valid range 0000-1001)
- Outputs: CA, CB, CC, CD, CE, CF, CG (active-low cathodes)
- Inputs 1010-1111: treat as don't-care (X) in K-map minimization

---

## Pre-Lab (Complete Before Coming to Lab)

### Step P1 — Complete the Truth Table

Fill in CA through CG for each decimal digit. Remember: 0 = segment ON, 1 = segment OFF.

| Decimal | B3 | B2 | B1 | B0 | CA | CB | CC | CD | CE | CF | CG |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 1 | 1 | 1 |
| 2 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 |
| 3 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| 4 | 0 | 1 | 0 | 0 | | | | | | | |
| 5 | 0 | 1 | 0 | 1 | | | | | | | |
| 6 | 0 | 1 | 1 | 0 | | | | | | | |
| 7 | 0 | 1 | 1 | 1 | | | | | | | |
| 8 | 1 | 0 | 0 | 0 | | | | | | | |
| 9 | 1 | 0 | 0 | 1 | | | | | | | |
| 10-15 | — | — | — | — | X | X | X | X | X | X | X |

Note: rows 0-3 are pre-filled to help you get started. Complete rows 4-9.

### Step P2 — K-Map Minimization

Draw 4x4 K-maps for each of the 7 outputs (CA through CG).
Variable assignment for K-map axes: rows = B3B2, columns = B1B0.
Mark 1's in K-map cells for rows where the segment is OFF (cathode=1).
Mark X in cells for don't-care inputs (decimal 10-15).

Derive simplified Sum-of-Products expressions for each segment.

### Step P3 — Draw the Circuit Block Diagram

Sketch the block diagram showing the 4 inputs and 7 outputs with the combinational
logic block in the middle. This is your design reference during the lab.

---

## Lab Procedure

### Phase 1 — Simulation in RedByte

#### Step 1 — Open RedByte and Select Lab 3

1. Open RedByte in your browser.
2. Go to Project surface → select "Lab 3 - Seven-Segment Display Driver".
3. Click "Load Starter".

#### Step 2 — Build the Decode Logic

1. Go to Design surface (canvas icon on left rail).
2. For each segment output (CA through CG), build a gate network from your K-map expression.
   - Example: if your K-map gives CA = B3' * B2' * B0 + B3 * B2', build this with AND and OR gates
   - Use NOT, AND2, AND3, OR2, OR3 nodes from the palette
3. Connect the 4 input nodes (B3, B2, B1, B0) to the appropriate gate inputs.
4. Connect each gate network output to its corresponding output node (CA, CB, ..., CG).

**Tip:** Build one segment at a time and verify it before moving to the next.

#### Step 3 — Apply the Basys3 Seven-Segment Preset

This step configures the hardware pin mapping. You must do this before submission.

1. Go to Project surface → Hardware tab.
2. In the Board Preset dropdown, select "Basys3 - Seven-Segment".
3. Confirm the port-to-pin mapping shows CA→W7, CB→W6, etc. (see table below).
4. The preset also enables AN[0] (W7) to drive the rightmost digit anode low.

**Basys3 Seven-Segment Pin Assignments:**

| Port | Direction | Basys3 Pin | Board Resource |
|---|---|---|---|
| B3 | Input | W17 | SW3 |
| B2 | Input | W16 | SW2 |
| B1 | Input | V16 | SW1 |
| B0 | Input | V17 | SW0 |
| CA | Output | W7 | Segment a |
| CB | Output | W6 | Segment b |
| CC | Output | U8 | Segment c |
| CD | Output | V8 | Segment d |
| CE | Output | U5 | Segment e |
| CF | Output | V5 | Segment f |
| CG | Output | U7 | Segment g |
| AN[0] | Output | U2 | Rightmost digit (drive low = enable) |
| AN[1] | Output | U4 | Disable (drive high = off) |
| AN[2] | Output | V4 | Disable (drive high = off) |
| AN[3] | Output | W4 | Disable (drive high = off) |

#### Step 4 — Enter Test Vectors in the Simulate Workspace

1. Open the Simulate workspace.
2. For each decimal digit 0-9, enter one test vector row:
   - Input columns: B3, B2, B1, B0
   - Expected output columns: CA, CB, CC, CD, CE, CF, CG
   - Use your completed truth table from pre-lab
3. You should have 10 rows total (one per digit).
4. Click "Run Verification".

Expected result: all 10 rows PASS (green).

If any row FAILS:
- Check the failing segment's K-map expression
- Check the gate wiring for that segment output on the Design surface
- Use the FAIL detail (expected vs. actual) to identify which gate has the error

#### Step 5 — Export Submission ZIP

1. Project surface → enter your name in "Student name" field.
2. Verify the Basys3 preset is shown as selected (required — gate will block export otherwise).
3. Click "Export Submission ZIP".
4. Save the `.zip` file. It contains `top.vhd`, `top.xdc`, and your verify evidence.

---

### Phase 2 — Hardware Implementation on Basys3 (If Board Available)

#### Step 6 — Open Vivado 2025.1

1. Launch Vivado 2025.1 from the Start menu (Windows) or terminal.
2. In the Vivado start screen, click "Create Project".

#### Step 7 — Create a New Vivado Project

1. Project name: `ECE141_Lab3` (no spaces or dashes)
2. Project location: your H: drive or Documents folder
3. Project type: RTL Project
4. Click Next through source/constraints screens (you will add files manually in next step)
5. Default part: we will change this. On the "Default Part" screen:
   - Filter by Family: Artix-7
   - Filter by Package: cpg236
   - Select: **xc7a35tcpg236-1** (this is the Basys3 FPGA)
6. Click Finish.

#### Step 8 — Add Sources from Your Submission ZIP

1. Unzip your submission ZIP file (right-click → Extract All).
2. In Vivado: Flow Navigator (left panel) → Add Sources (or File → Add Sources).
3. Add Design Sources → Add Files → navigate to the unzipped folder:
   - Add `top.vhd` (the VHDL netlist generated by RedByte)
4. Add Constraints → Add Files:
   - Add `top.xdc` (the pin constraint file generated by RedByte)
5. Click Finish.

#### Step 9 — Run Synthesis

1. In Flow Navigator: click "Run Synthesis".
2. Wait for synthesis to complete (1-3 minutes).
3. Check for errors in the Messages window. Warnings about timing are usually ignorable.
4. When synthesis finishes: click "Run Implementation".

#### Step 10 — Run Implementation and Generate Bitstream

1. Click "Run Implementation" (if not already started automatically).
2. After implementation: click "Generate Bitstream".
3. A dialog may ask if you want to run synthesis/implementation first — click OK.
4. Wait for bitstream generation to complete.
5. When done: in the dialog that appears, select "Open Hardware Manager".

#### Step 11 — Program the Basys3 Board

1. Connect the Basys3 board to your PC using the USB-A to micro-USB cable.
2. Make sure the Basys3 power switch is ON (slide switch near the USB port).
3. In Vivado Hardware Manager: click "Open Target" → "Auto Connect".
   - Vivado should detect the board: `xc7a35t_0`
4. Right-click `xc7a35t_0` → "Program Device".
5. In the dialog, verify the bitstream file path ends in `.bit`.
6. Click "Program".
7. The board LEDs may flicker briefly during programming. You should see "Programming Succeeded" in the Tcl console.

#### Step 12 — Test on the Board

1. The board is now running your SSD driver circuit.
2. Toggle slide switches SW3, SW2, SW1, SW0 (leftmost group of 4 on the right side).
3. Observe the rightmost seven-segment digit.
4. Verify:
   - SW = 0000 → digit "0" displays
   - SW = 0001 → digit "1" displays
   - SW = 0010 → digit "2" displays
   - SW = 0011 → digit "3" displays
   - ... continue through SW = 1001 → digit "9"
5. SW = 1010 through 1111 may display anything (don't-care inputs).

**Demonstrate your working board to the instructor before leaving the lab.**

---

## Deliverables

1. **Pre-Lab (due at lab start):**
   - Completed truth table (all 10 rows, digits 0-9)
   - K-maps for all 7 segments (CA-CG) with minimization work shown
   - Simplified Boolean expressions for all 7 segments

2. **Lab Report (due next class period):**
   - Completed truth table (final version)
   - All 7 K-map diagrams with simplified expressions
   - Screenshot of the RedByte Simulate workspace showing all 10 rows PASS
   - Basys3 pin assignment table (copy from Step 4 above, with your hand-filled values)
   - Observation: list at least 3 digits you verified working on the board (with switch positions)

3. **Submission ZIP:** uploaded to course system

---

## Grading Checklist

- [ ] Truth table complete and correct for all 10 digits
- [ ] K-maps filled correctly and expressions minimized
- [ ] RedByte circuit implements correct decode logic
- [ ] Simulate checks PASS on all 10 digit test vectors
- [ ] Basys3 preset applied (submission gate: `basys3-profile`)
- [ ] Submission ZIP exported and submitted
- [ ] Hardware: 3 or more digits verified on Basys3 board
- [ ] Instructor demonstration completed

---

## Troubleshooting

**"Vivado says xc7a35tcpg236-1 is not found."**
Vivado must have Artix-7 device support installed. Check Vivado installation options.

**"Synthesis error: port 'CA' not found in design."**
The output node in RedByte may not be labeled exactly "CA". Return to Design surface,
double-click the output node, and verify the label matches exactly.

**"The board programs successfully but the display shows the wrong digit."**
Check your truth table for that specific digit. Verify the K-map expression was
entered correctly into the gate network. Compare expected vs. actual in the failing Simulate check row.

**"The display is completely dark."**
AN[0] must be driven LOW (logic 0) to enable the rightmost digit anode.
The Basys3 preset should set this automatically. Check that the preset was applied
before exporting.

**"Hardware Manager can't find the board."**
- Confirm the USB cable is plugged in to the micro-USB port (not the USB host port on the board)
- Confirm the power switch is ON
- Try a different USB cable or USB port on your PC
- Reinstall Digilent USB drivers if needed (available at digilent.com)
